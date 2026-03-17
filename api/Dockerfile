FROM python:3.13-slim AS base
WORKDIR /app

# Build dependencies for packages with C extensions (e.g. falkordb, bcrypt)
# Node.js for npm-based MCP servers (e.g. Ghost CMS, GitHub, etc.)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc g++ make curl \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
