# Dockerfile.backend
# Python 3.12 slim image for the Flask backend.
# Installs build deps required by pyarrow/deltalake/azure SDKs and then installs Python deps.
# Uses gunicorn to run the Flask app (expects app.main:app).

FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DEBIAN_FRONTEND=noninteractive

WORKDIR /app

# Install system packages needed to build/install some Python packages (pyarrow, deltalake, etc.)
# Remove or trim packages if you don't need heavy libs (rustc/cargo) to reduce image size.
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    gcc \
    g++ \
    curl \
    ca-certificates \
    libssl-dev \
    libgomp1 \
    pkg-config \
    libpq-dev \
    libsnappy-dev \
    zlib1g-dev \
    libzstd-dev \
    rustc \
    cargo \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for Docker layer caching
COPY backend/app/requirements.txt /app/requirements.txt

# Upgrade pip and install wheel tools, then install requirements
RUN pip install --upgrade pip setuptools wheel \
 && pip install --no-cache-dir -r /app/requirements.txt

# Copy application source code
COPY backend/app /app/app

# Expose application port
EXPOSE 5000

# Healthcheck for container orchestrators (requires curl available in image)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://127.0.0.1:5000/health || exit 1

# Run the app with gunicorn. Ensure backend/app/main.py defines `app = Flask(__name__)`.
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "4", "app.main:app"]
