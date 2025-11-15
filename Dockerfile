FROM python:3.10-slim
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip uninstall -y keras tensorflow && \
    pip install --no-cache-dir -r requirements.txt

COPY siamese_api.py .

ENV TF_USE_LEGACY_KERAS=1
ENV TF_CPP_MIN_LOG_LEVEL=2
ENV TF_FORCE_GPU_ALLOW_GROWTH=true
ENV PYTHONUNBUFFERED=1
ENV PORT=7860

EXPOSE 7860

HEALTHCHECK --start-period=420s --interval=30s --timeout=10s --retries=3 \
    CMD curl -f http://localhost:7860/health || exit 1

CMD ["uvicorn", "siamese_api:app", "--host", "0.0.0.0", "--port", "7860", "--timeout-keep-alive", "300"]