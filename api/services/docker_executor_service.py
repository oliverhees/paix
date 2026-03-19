"""Docker Executor Service — sandboxed code execution in ephemeral containers.

Runs user/AI-generated code inside isolated Docker containers with
resource limits, network isolation, and timeouts.
"""

import asyncio
import logging
import tempfile
import os
from dataclasses import dataclass

from config import settings

logger = logging.getLogger(__name__)

LANGUAGE_CONFIG = {
    "python": {
        "file_ext": ".py",
        "cmd": ["python3", "/sandbox/code.py"],
    },
    "javascript": {
        "file_ext": ".js",
        "cmd": ["node", "/sandbox/code.js"],
    },
    "bash": {
        "file_ext": ".sh",
        "cmd": ["bash", "/sandbox/code.sh"],
    },
}


@dataclass
class CodeExecutionResult:
    """Result of a sandboxed code execution."""
    stdout: str
    stderr: str
    exit_code: int
    timed_out: bool
    language: str
    duration_ms: int


class DockerExecutorService:
    """Manages ephemeral Docker containers for code execution."""

    async def run_code(
        self,
        language: str,
        code: str,
        timeout_seconds: int | None = None,
    ) -> CodeExecutionResult:
        """
        Execute code in an isolated Docker container.

        Args:
            language: One of 'python', 'javascript', 'bash'
            code: The source code to execute
            timeout_seconds: Override default timeout

        Returns:
            CodeExecutionResult with stdout, stderr, exit_code, timing
        """
        import time
        start = time.monotonic()

        if not settings.docker_sandbox_enabled:
            return CodeExecutionResult(
                stdout="",
                stderr="Docker sandbox is disabled. Enable docker_sandbox_enabled in config.",
                exit_code=1,
                timed_out=False,
                language=language,
                duration_ms=0,
            )

        if language not in LANGUAGE_CONFIG:
            return CodeExecutionResult(
                stdout="",
                stderr=f"Unsupported language: {language}. Supported: {', '.join(LANGUAGE_CONFIG.keys())}",
                exit_code=1,
                timed_out=False,
                language=language,
                duration_ms=0,
            )

        timeout = timeout_seconds or settings.docker_sandbox_timeout
        lang_config = LANGUAGE_CONFIG[language]

        # Write code to a temp file
        with tempfile.NamedTemporaryFile(
            mode="w",
            suffix=lang_config["file_ext"],
            delete=False,
            prefix="paione_sandbox_",
        ) as f:
            f.write(code)
            code_file = f.name

        try:
            # Build docker run command
            cmd = [
                "docker", "run",
                "--rm",
                "--network=none",
                "--read-only",
                "--tmpfs", "/tmp:rw,noexec,nosuid,size=64m",
                f"--memory={settings.docker_sandbox_memory}",
                f"--cpus={settings.docker_sandbox_cpus}",
                "--pids-limit=64",
                "--security-opt=no-new-privileges",
                "-v", f"{code_file}:/sandbox/code{lang_config['file_ext']}:ro",
                settings.docker_sandbox_image,
                *lang_config["cmd"],
            ]

            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

            timed_out = False
            try:
                stdout_bytes, stderr_bytes = await asyncio.wait_for(
                    process.communicate(),
                    timeout=timeout,
                )
            except asyncio.TimeoutError:
                timed_out = True
                process.kill()
                await process.wait()
                stdout_bytes = b""
                stderr_bytes = f"Execution timed out after {timeout} seconds.".encode()

            duration_ms = int((time.monotonic() - start) * 1000)

            return CodeExecutionResult(
                stdout=stdout_bytes.decode("utf-8", errors="replace")[:10000],
                stderr=stderr_bytes.decode("utf-8", errors="replace")[:5000],
                exit_code=process.returncode or 1,
                timed_out=timed_out,
                language=language,
                duration_ms=duration_ms,
            )

        except FileNotFoundError:
            duration_ms = int((time.monotonic() - start) * 1000)
            return CodeExecutionResult(
                stdout="",
                stderr="Docker is not installed or not accessible. Please install Docker to use code execution.",
                exit_code=1,
                timed_out=False,
                language=language,
                duration_ms=duration_ms,
            )
        except Exception as exc:
            duration_ms = int((time.monotonic() - start) * 1000)
            logger.error("Docker execution error: %s", exc)
            return CodeExecutionResult(
                stdout="",
                stderr=f"Execution error: {str(exc)}",
                exit_code=1,
                timed_out=False,
                language=language,
                duration_ms=duration_ms,
            )
        finally:
            # Clean up temp file
            try:
                os.unlink(code_file)
            except OSError:
                pass

    async def check_available(self) -> bool:
        """Check if Docker is available and the sandbox image exists."""
        if not settings.docker_sandbox_enabled:
            return False
        try:
            proc = await asyncio.create_subprocess_exec(
                "docker", "image", "inspect", settings.docker_sandbox_image,
                stdout=asyncio.subprocess.DEVNULL,
                stderr=asyncio.subprocess.DEVNULL,
            )
            await proc.wait()
            return proc.returncode == 0
        except Exception:
            return False


# Singleton
docker_executor = DockerExecutorService()
