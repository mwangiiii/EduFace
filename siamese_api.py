from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
import numpy as np
from PIL import Image
import io
import os
import sys
import traceback
import requests  # More reliable than gdown
from threading import Thread, Lock
import time

# Initialize FastAPI FIRST
app = FastAPI()

# Global variables for model state
model = None
model_loading = False
model_load_started = False
model_error = None
model_lock = Lock()
load_start_time = None

# ================================
# 1. MODEL DOWNLOAD & LOAD
# ================================
MODEL_PATH = "siamese_model.h5"
MODEL_URL = os.getenv("MODEL_URL", "https://github.com/mwangiiii/EduFace/releases/download/v1.0.0-model/siamese_model.h5")

def download_model():
    """Download model from GitHub release or other URL"""
    if os.path.exists(MODEL_PATH):
        file_size = os.path.getsize(MODEL_PATH) / (1024*1024)
        print(f"✅ Model already exists at {MODEL_PATH} ({file_size:.2f}MB)")
        return
    
    try:
        print("=" * 60)
        print("🔽 DOWNLOADING MODEL FROM CLOUD")
        print(f"📍 URL: {MODEL_URL}")
        print("=" * 60)
        
        # Download with requests (more reliable than gdown)
        response = requests.get(MODEL_URL, stream=True, timeout=600, allow_redirects=True)
        response.raise_for_status()
        
        total_size = int(response.headers.get('content-length', 0))
        downloaded = 0
        
        print(f"📊 Total size: {total_size/(1024*1024):.2f}MB")
        
        with open(MODEL_PATH, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)
                    downloaded += len(chunk)
                    if total_size > 0:
                        percent = (downloaded / total_size) * 100
                        mb_downloaded = downloaded / (1024*1024)
                        mb_total = total_size / (1024*1024)
                        print(f"⏳ Progress: {percent:.1f}% ({mb_downloaded:.1f}MB / {mb_total:.1f}MB)", end='\r')
        
        file_size = os.path.getsize(MODEL_PATH) / (1024*1024)
        print(f"\n✅ Model downloaded successfully! Size: {file_size:.2f}MB")
        print("=" * 60)
        
    except requests.exceptions.RequestException as e:
        print(f"❌ Download failed: {e}")
        traceback.print_exc()
        raise RuntimeError(f"Could not download model from {MODEL_URL}: {e}")
    except Exception as e:
        print(f"❌ Unexpected error during download: {e}")
        traceback.print_exc()
        raise

def load_siamese_model():
    """Load the model with custom objects"""
    global model, model_loading, model_error, load_start_time
    
    with model_lock:
        if model is not None:
            print("✅ Model already loaded, skipping")
            return model
        
        if model_loading:
            print("⏳ Model already loading in another thread")
            return None
        
        model_loading = True
        load_start_time = time.time()
    
    try:
        print("=" * 60)
        print("🚀 STARTING MODEL INITIALIZATION")
        print("=" * 60)
        
        # Download model first
        download_model()
        
        print("📦 Importing TensorFlow and Keras...")
        import_start = time.time()
        
        # Configure TensorFlow
        os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'
        os.environ['TF_FORCE_GPU_ALLOW_GROWTH'] = 'true'
        
        import tensorflow as tf
        
        # Disable GPU
        tf.config.set_visible_devices([], 'GPU')
        tf.config.threading.set_inter_op_parallelism_threads(2)
        tf.config.threading.set_intra_op_parallelism_threads(2)
        
        from keras.models import load_model
        from keras.layers import Layer
        
        import_time = time.time() - import_start
        print(f"✅ TensorFlow imported in {import_time:.1f}s")
        
        # Define custom layer
        print("🔧 Defining custom L1Dist layer...")
        class L1Dist(Layer):
            def __init__(self, **kwargs):
                super().__init__(**kwargs)
            
            def call(self, input_embedding, validation_embedding):
                return tf.math.abs(input_embedding - validation_embedding)
        
        # Load model
        print(f"📂 Loading model from {MODEL_PATH}...")
        load_start = time.time()
        
        loaded_model = load_model(
            MODEL_PATH, 
            custom_objects={'L1Dist': L1Dist},
            compile=False
        )
        
        load_time = time.time() - load_start
        print(f"✅ Model loaded in {load_time:.1f}s")
        
        # Test model
        print("🧪 Testing model...")
        test_start = time.time()
        dummy_input = np.random.rand(1, 100, 100, 3).astype(np.float32)
        test_pred = loaded_model.predict([dummy_input, dummy_input], verbose=0)
        test_time = time.time() - test_start
        print(f"✅ Model test successful in {test_time:.1f}s! Output shape: {test_pred.shape}")
        
        total_time = time.time() - load_start_time
        print("=" * 60)
        print(f"🎉 MODEL READY! Total time: {total_time:.1f}s ({total_time/60:.1f} min)")
        print("=" * 60)
        
        with model_lock:
            model = loaded_model
            model_loading = False
        
        return loaded_model
        
    except Exception as e:
        with model_lock:
            model_error = str(e)
            model_loading = False
        
        elapsed = time.time() - load_start_time if load_start_time else 0
        print(f"❌ Failed to load model after {elapsed:.1f}s: {e}")
        traceback.print_exc()
        raise

def trigger_model_load_background():
    """Trigger model loading in a background thread"""
    global model_load_started
    
    with model_lock:
        if model_load_started or model is not None:
            return
        model_load_started = True
    
    print("🔄 Triggering background model load...")
    thread = Thread(target=load_siamese_model, daemon=True)
    thread.start()

# ================================
# 2. STARTUP EVENT
# ================================
@app.on_event("startup")
async def startup_event():
    """Start model loading in background"""
    print("=" * 60)
    print("🚀 FastAPI Application Starting")
    print("=" * 60)
    print(f"Python: {sys.version}")
    print(f"Working dir: {os.getcwd()}")
    print(f"Model path: {MODEL_PATH}")
    print(f"Model URL: {MODEL_URL}")
    
    trigger_model_load_background()
    
    print("✅ Server ready for health checks")
    print("⏳ Model loading in background (check /health)")
    print("=" * 60)

# ================================
# 3. IMAGE PREPROCESSING
# ================================
def preprocess_image(image_bytes):
    """Preprocess image for model input"""
    try:
        img = Image.open(io.BytesIO(image_bytes)).convert('RGB')
        img = img.resize((100, 100))
        img_array = np.array(img, dtype=np.float32) / 255.0
        img_array = np.expand_dims(img_array, axis=0)
        return img_array
    except Exception as e:
        raise ValueError(f"Image preprocessing failed: {e}")

# ================================
# 4. API ENDPOINTS
# ================================
@app.get("/")
def root():
    """Health check endpoint"""
    elapsed = None
    if load_start_time:
        elapsed = time.time() - load_start_time
    
    status = "ready" if model is not None else "loading" if model_loading else "not_started" if not model_load_started else "error"
    
    return {
        "status": status,
        "message": "Siamese Network API",
        "model_loaded": model is not None,
        "model_loading": model_loading,
        "loading_time_seconds": round(elapsed, 1) if elapsed else None,
        "estimated_wait_minutes": "3-5 minutes" if model_loading else None,
        "error": model_error
    }

@app.get("/health")
def health():
    """Detailed health check"""
    elapsed = None
    if load_start_time:
        elapsed = time.time() - load_start_time
    
    return {
        "server_status": "healthy",
        "model_status": "ready" if model is not None else "loading" if model_loading else "not_started" if not model_load_started else "error",
        "model_loaded": model is not None,
        "model_loading": model_loading,
        "model_path": MODEL_PATH,
        "model_exists": os.path.exists(MODEL_PATH),
        "model_size_mb": f"{os.path.getsize(MODEL_PATH) / (1024*1024):.2f}" if os.path.exists(MODEL_PATH) else None,
        "loading_time_seconds": round(elapsed, 1) if elapsed else None,
        "error": model_error
    }

@app.post("/predict")
async def predict(file1: UploadFile = File(...), file2: UploadFile = File(...)):
    """Compare two images using Siamese network"""
    
    if model_loading:
        elapsed = time.time() - load_start_time if load_start_time else 0
        raise HTTPException(
            status_code=503,
            detail={
                "error": "Model is still loading",
                "loading_time_seconds": round(elapsed, 1),
                "message": "Please wait and check /health for status"
            }
        )
    
    if model is None:
        error_msg = f"Model failed to load. Error: {model_error}" if model_error else "Model not loaded"
        raise HTTPException(status_code=503, detail=error_msg)
    
    try:
        image1_bytes = await file1.read()
        image2_bytes = await file2.read()
        
        if not image1_bytes or not image2_bytes:
            raise HTTPException(status_code=400, detail="One or both files are empty")
        
        img1 = preprocess_image(image1_bytes)
        img2 = preprocess_image(image2_bytes)
        
        prediction = model.predict([img1, img2], verbose=0)
        similarity = float(prediction[0][0])
        
        threshold = 0.5
        is_similar = similarity >= threshold
        
        return JSONResponse({
            "similarity_score": similarity,
            "is_similar": is_similar,
            "threshold": threshold
        })
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"Error during prediction: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")