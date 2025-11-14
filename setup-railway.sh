#!/bin/bash

echo "🚂 Setting up project for Railway deployment..."

# Create requirements.txt
cat > requirements.txt << 'REQUIREMENTS'
fastapi==0.104.1
uvicorn[standard]==0.24.0
python-multipart==0.0.6
pillow==10.1.0
numpy==1.24.3
tensorflow==2.15.0
keras==2.15.0
gdown==4.7.1
REQUIREMENTS

# Create Dockerfile
cat > Dockerfile << 'DOCKERFILE'
FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    wget curl && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

COPY siamese_api.py .

ENV TF_CPP_MIN_LOG_LEVEL=2
ENV TF_FORCE_GPU_ALLOW_GROWTH=true
ENV PYTHONUNBUFFERED=1
ENV PORT=8080

EXPOSE 8080

HEALTHCHECK --start-period=360s --interval=30s --timeout=10s --retries=3 \
    CMD curl -f http://localhost:${PORT:-8080}/health || exit 1

CMD uvicorn siamese_api:app --host 0.0.0.0 --port ${PORT:-8080} --timeout-keep-alive 300
DOCKERFILE

# Create railway.json
cat > railway.json << 'RAILWAY'
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile"
  },
  "deploy": {
    "numReplicas": 1,
    "sleepApplication": false,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3,
    "healthcheckPath": "/health",
    "healthcheckTimeout": 300,
    "startCommand": "uvicorn siamese_api:app --host 0.0.0.0 --port $PORT"
  }
}
RAILWAY

# Create .dockerignore
cat > .dockerignore << 'DOCKERIGNORE'
__pycache__
*.pyc
.git
*.log
.env
.venv
venv
*.h5
!siamese_model.h5
DOCKERIGNORE

# Create .gitignore
cat > .gitignore << 'GITIGNORE'
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
venv/
ENV/
.venv
*.h5
.env
.DS_Store
GITIGNORE

echo ""
echo "✅ Railway setup complete!"
echo ""
echo "📁 Files created:"
ls -lh requirements.txt Dockerfile railway.json .dockerignore .gitignore 2>/dev/null | grep -v "^total"
echo ""
echo "🚂 Next steps for Railway deployment:"
echo ""
echo "1. Initialize git repository (if not already):"
echo "   git init"
echo "   git add ."
echo "   git commit -m 'Initial commit'"
echo ""
echo "2. Deploy to Railway:"
echo "   - Go to https://railway.app"
echo "   - Click 'New Project' → 'Deploy from GitHub repo'"
echo "   - Select your repository"
echo "   - Railway will auto-detect Dockerfile and deploy"
echo ""
echo "3. Configure Railway:"
echo "   - Go to your project settings"
echo "   - Set healthcheck path: /health"
echo "   - Set healthcheck timeout: 300 seconds"
echo "   - Ensure at least 4GB RAM allocated"
echo ""
echo "4. Monitor deployment:"
echo "   - Watch build logs in Railway dashboard"
echo "   - Wait 6-8 minutes for first deployment (model loading)"
echo "   - Check /health endpoint to verify model status"
echo ""
echo "💡 Test locally first:"
echo "   docker build -t siamese-api ."
echo "   docker run -p 8080:8080 --memory=4g siamese-api"
echo ""