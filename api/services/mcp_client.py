"""MCP Client Manager — connects to MCP servers, discovers tools, executes tool calls."""

import json
import logging
import uuid
from contextlib import AsyncExitStack
from typing import Any

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
from mcp.client.sse import sse_client

logger = logging.getLogger(__name__)


class McpClientManager:
    """Manages MCP server connections with lazy-connect and connection pooling.

    Connections are established on-demand (first tool call or explicit discover)
    and cached for reuse. Each connection is tracked via AsyncExitStack for
    clean shutdown.
    """

    def __init__(self) -> None:
        # server_id (str) → (session, exit_stack)
        self._sessions: dict[str, tuple[ClientSession, AsyncExitStack]] = {}

    # ──────────────────────────────────────────────
    # Connection Management
    # ──────────────────────────────────────────────

    async def _connect(
        self,
        server_id: str,
        transport_type: str,
        config: dict[str, Any],
    ) -> ClientSession:
        """Establish a connection to an MCP server.

        Supports stdio, sse, and streamable_http transports.
        """
        # Return existing session if connected
        if server_id in self._sessions:
            return self._sessions[server_id][0]

        stack = AsyncExitStack()

        try:
            if transport_type == "stdio":
                command = config.get("command", "")
                args = config.get("args", [])
                env = config.get("env") or None
                if not command:
                    raise ValueError("stdio transport requires 'command' in config")

                server_params = StdioServerParameters(
                    command=command,
                    args=args if isinstance(args, list) else [args],
                    env=env,
                )
                transport = await stack.enter_async_context(
                    stdio_client(server_params)
                )
                read_stream, write_stream = transport

            elif transport_type == "sse":
                url = config.get("url", "")
                if not url:
                    raise ValueError("sse transport requires 'url' in config")

                transport = await stack.enter_async_context(sse_client(url))
                read_stream, write_stream = transport

            elif transport_type == "streamable_http":
                url = config.get("url", "")
                if not url:
                    raise ValueError("streamable_http transport requires 'url' in config")

                # streamable_http returns (read, write, session_id)
                try:
                    from mcp.client.streamable_http import streamable_http_client

                    transport = await stack.enter_async_context(
                        streamable_http_client(url)
                    )
                    read_stream, write_stream = transport[0], transport[1]
                except ImportError:
                    # Fallback to SSE if streamable_http not available
                    logger.warning(
                        "streamable_http not available, falling back to SSE for %s",
                        server_id,
                    )
                    transport = await stack.enter_async_context(sse_client(url))
                    read_stream, write_stream = transport

            else:
                raise ValueError(f"Unknown transport type: {transport_type}")

            session = await stack.enter_async_context(
                ClientSession(read_stream, write_stream)
            )
            await session.initialize()

            self._sessions[server_id] = (session, stack)
            logger.info("MCP connected: %s (%s)", server_id, transport_type)
            return session

        except Exception:
            await stack.aclose()
            raise

    async def disconnect(self, server_id: str) -> None:
        """Disconnect from a specific MCP server."""
        entry = self._sessions.pop(server_id, None)
        if entry:
            _, stack = entry
            try:
                await stack.aclose()
            except Exception as e:
                logger.warning("Error disconnecting MCP %s: %s", server_id, e)
            logger.info("MCP disconnected: %s", server_id)

    async def disconnect_all(self) -> None:
        """Disconnect from all MCP servers. Call on application shutdown."""
        server_ids = list(self._sessions.keys())
        for sid in server_ids:
            await self.disconnect(sid)

    def is_connected(self, server_id: str) -> bool:
        """Check if a server is currently connected."""
        return server_id in self._sessions

    # ──────────────────────────────────────────────
    # Tool Discovery
    # ──────────────────────────────────────────────

    async def discover_tools(
        self,
        server_id: str,
        transport_type: str,
        config: dict[str, Any],
    ) -> list[dict]:
        """Connect to an MCP server and discover available tools.

        Returns tools in Anthropic Tool Use format:
        [{"name": "...", "description": "...", "input_schema": {...}}, ...]
        """
        session = await self._connect(server_id, transport_type, config)

        result = await session.list_tools()
        tools = []
        for tool in result.tools:
            tools.append({
                "name": tool.name,
                "description": tool.description or "",
                "input_schema": tool.inputSchema if tool.inputSchema else {
                    "type": "object",
                    "properties": {},
                },
            })

        logger.info(
            "MCP discovered %d tools from %s", len(tools), server_id
        )
        return tools

    # ──────────────────────────────────────────────
    # Tool Execution
    # ──────────────────────────────────────────────

    async def call_tool(
        self,
        server_id: str,
        transport_type: str,
        config: dict[str, Any],
        tool_name: str,
        arguments: dict[str, Any],
    ) -> str:
        """Execute a tool call on an MCP server.

        Lazy-connects if not already connected.
        Returns the tool result as a string.
        """
        session = await self._connect(server_id, transport_type, config)

        result = await session.call_tool(tool_name, arguments)

        # Convert MCP content blocks to string
        parts = []
        for block in result.content:
            if hasattr(block, "text"):
                parts.append(block.text)
            elif hasattr(block, "data"):
                parts.append(f"[Binary data: {block.mimeType or 'unknown'}]")
            else:
                parts.append(str(block))

        output = "\n".join(parts) if parts else "Tool executed with no output."

        if result.isError:
            return f"MCP tool error: {output}"

        return output

    # ──────────────────────────────────────────────
    # Connection Test
    # ──────────────────────────────────────────────

    async def test_connection(
        self,
        transport_type: str,
        config: dict[str, Any],
    ) -> dict[str, Any]:
        """Test connection to an MCP server without persisting the session.

        Returns {"success": bool, "tools_count": int, "error": str | None}
        """
        temp_id = f"_test_{uuid.uuid4().hex[:8]}"
        try:
            tools = await self.discover_tools(temp_id, transport_type, config)
            return {
                "success": True,
                "tools_count": len(tools),
                "tools": [t["name"] for t in tools],
                "error": None,
            }
        except Exception as e:
            logger.warning("MCP connection test failed: %s", e)
            return {
                "success": False,
                "tools_count": 0,
                "tools": [],
                "error": str(e),
            }
        finally:
            await self.disconnect(temp_id)


# Singleton instance
mcp_client_manager = McpClientManager()
