FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY siamese_api.py .

# OPTIONAL: Pre-download model during build (saves 1-2 minutes on startup)
# Uncomment the line below to download model at build time
# RUN python -c "import gdown; gdown.download('https://drive.google.com/uc?id=1BxfoPP9UPx5okXed-hw6-cei812A6jLW', 'siamese_model.h5', quiet=False)"

EXPOSE 8080

# Health check - server responds immediately, model loads in background
HEALTHCHECK --start-period=360s --interval=30s --timeout=10s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Set environment variables to optimize TensorFlow
ENV TF_CPP_MIN_LOG_LEVEL=2
ENV TF_FORCE_GPU_ALLOW_GROWTH=true
ENV PYTHONUNBUFFERED=1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080", "--timeout-keep-alive", "300"]