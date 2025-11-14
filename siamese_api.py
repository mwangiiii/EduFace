from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
import numpy as np
from PIL import Image
import io
import os
import gdown
import sys
import traceback
import asyncio
from threading import Thread, Lock
import time

# Initialize FastAPI FIRST - this allows health checks to pass immediately
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
MODEL_URL = "https://drive.google.com/uc?id=1BxfoPP9UPx5okXed-hw6-cei812A6jLW"

def download_model():
    """Download model if it doesn't exist"""
    if not os.path.exists(MODEL_PATH):
        try:
            print("🔽 Downloading model from Google Drive...")
            gdown.download(MODEL_URL, MODEL_PATH, quiet=False)
            print("✅ Model downloaded successfully!")
        except Exception as e:
            print(f"❌ Failed to download model: {e}")
            raise RuntimeError(f"Model download failed: {e}")
    else:
        print(f"✅ Model already exists at {MODEL_PATH}")

def load_siamese_model():
    """Load the model with custom objects - THIS CAN TAKE UP TO 6 MINUTES"""
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
        print("🚀 STARTING MODEL LOAD - THIS MAY TAKE UP TO 6 MINUTES")
        print("=" * 60)
        
        # Download first
        download_model()
        
        print("📦 Importing TensorFlow and Keras (can take 2-3 minutes)...")
        import_start = time.time()
        
        # Configure TensorFlow before importing
        os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'
        os.environ['TF_FORCE_GPU_ALLOW_GROWTH'] = 'true'
        
        import tensorflow as tf
        
        # Disable GPU
        tf.config.set_visible_devices([], 'GPU')
        
        # Set thread limits to reduce resource usage
        tf.config.threading.set_inter_op_parallelism_threads(2)
        tf.config.threading.set_intra_op_parallelism_threads(2)
        
        from keras.models import load_model
        from keras.layers import Layer
        
        import_time = time.time() - import_start
        print(f"✅ TensorFlow imported successfully in {import_time:.1f} seconds")
        
        print("🔧 Defining custom L1Dist layer...")
        class L1Dist(Layer):
            def __init__(self, **kwargs):
                super().__init__(**kwargs)
            
            def call(self, input_embedding, validation_embedding):
                return tf.math.abs(input_embedding - validation_embedding)
        
        print(f"📂 Loading model from {MODEL_PATH}...")
        file_size = os.path.getsize(MODEL_PATH) / (1024*1024)
        print(f"📊 Model file size: {file_size:.2f} MB")
        
        load_model_start = time.time()
        print("⏳ Loading model architecture and weights (can take 3-4 minutes)...")
        
        loaded_model = load_model(
            MODEL_PATH, 
            custom_objects={'L1Dist': L1Dist},
            compile=False
        )
        
        load_model_time = time.time() - load_model_start
        print(f"✅ Model loaded in {load_model_time:.1f} seconds")
        
        # Test the model
        print("🧪 Testing model with dummy input...")
        test_start = time.time()
        dummy_input = np.random.rand(1, 100, 100, 3).astype(np.float32)
        test_pred = loaded_model.predict([dummy_input, dummy_input], verbose=0)
        test_time = time.time() - test_start
        print(f"✅ Model test successful in {test_time:.1f}s! Output shape: {test_pred.shape}")
        
        total_time = time.time() - load_start_time
        print("=" * 60)
        print(f"🎉 MODEL READY! Total load time: {total_time:.1f} seconds ({total_time/60:.1f} minutes)")
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
        print(f"❌ Failed to load model after {elapsed:.1f} seconds: {e}")
        print(traceback.format_exc())
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
    """Start model loading in background thread - don't block startup"""
    print("=" * 60)
    print("🚀 FastAPI Application Starting")
    print("=" * 60)
    print(f"Python version: {sys.version}")
    print(f"Working directory: {os.getcwd()}")
    print(f"Model path: {MODEL_PATH}")
    print(f"Model exists: {os.path.exists(MODEL_PATH)}")
    
    # Start loading model in background immediately
    trigger_model_load_background()
    
    print("✅ Server ready to accept health checks")
    print("⏳ Model loading in background (check /health for status)")
    print("=" * 60)

# ================================
# 3. IMAGE PREPROCESSING
# ================================
def preprocess_image(image_bytes):
    """
    Preprocess image bytes for model input.
    Expected input: RGB image
    Output: Normalized numpy array of shape (1, 100, 100, 3)
    """
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
    """Health check endpoint - ALWAYS returns 200 for container orchestrators"""
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
        "estimated_wait_minutes": "2-6 minutes" if model_loading else None,
        "error": model_error
    }

@app.get("/health")
def health():
    """Detailed health check - ALWAYS returns 200"""
    elapsed = None
    if load_start_time:
        elapsed = time.time() - load_start_time
    
    return {
        "server_status": "healthy",  # Server is always healthy
        "model_status": "ready" if model is not None else "loading" if model_loading else "not_started" if not model_load_started else "error",
        "model_loaded": model is not None,
        "model_loading": model_loading,
        "model_path": MODEL_PATH,
        "model_exists": os.path.exists(MODEL_PATH),
        "model_size_mb": f"{os.path.getsize(MODEL_PATH) / (1024*1024):.2f}" if os.path.exists(MODEL_PATH) else None,
        "loading_time_seconds": round(elapsed, 1) if elapsed else None,
        "estimated_total_time": "2-6 minutes",
        "error": model_error,
        "note": "Server is ready but model may still be loading. Check model_loaded field."
    }

@app.post("/load-model")
async def load_model_endpoint(background_tasks: BackgroundTasks):
    """
    Manually trigger model loading (if not already loading/loaded)
    Useful for pre-warming the model
    """
    if model is not None:
        return {"status": "already_loaded", "message": "Model is already loaded"}
    
    if model_loading:
        elapsed = time.time() - load_start_time if load_start_time else 0
        return {
            "status": "loading", 
            "message": "Model is currently loading",
            "loading_time_seconds": round(elapsed, 1),
            "estimated_remaining": "2-6 minutes total"
        }
    
    trigger_model_load_background()
    
    return {
        "status": "started",
        "message": "Model loading started in background",
        "estimated_time": "2-6 minutes",
        "check_status_at": "/health"
    }

@app.post("/predict")
async def predict(file1: UploadFile = File(...), file2: UploadFile = File(...)):
    """
    Compare two images using the Siamese network.
    
    Args:
        file1: First image file
        file2: Second image file
    
    Returns:
        JSON with similarity score (0-1, where 1 means identical)
    """
    # If model is loading, return helpful message
    if model_loading:
        elapsed = time.time() - load_start_time if load_start_time else 0
        raise HTTPException(
            status_code=503,
            detail={
                "error": "Model is still loading",
                "loading_time_seconds": round(elapsed, 1),
                "estimated_total_time": "2-6 minutes",
                "message": "Please wait and try again. Check /health for status."
            }
        )
    
    # If model hasn't started loading, trigger it
    if not model_load_started and model is None:
        trigger_model_load_background()
        raise HTTPException(
            status_code=503,
            detail={
                "error": "Model loading initiated",
                "message": "Model was not loaded. Loading started now. Please wait 2-6 minutes and try again.",
                "check_status_at": "/health"
            }
        )
    
    # If model failed to load
    if model is None:
        error_msg = f"Model failed to load. Error: {model_error}" if model_error else "Model not loaded"
        raise HTTPException(status_code=503, detail=error_msg)
    
    try:
        # Read image bytes
        image1_bytes = await file1.read()
        image2_bytes = await file2.read()
        
        # Validate files are not empty
        if not image1_bytes or not image2_bytes:
            raise HTTPException(status_code=400, detail="One or both files are empty")
        
        # Preprocess images
        img1 = preprocess_image(image1_bytes)
        img2 = preprocess_image(image2_bytes)
        
        # Make prediction
        prediction = model.predict([img1, img2], verbose=0)
        similarity = float(prediction[0][0])
        
        # Determine if images are similar (threshold can be adjusted)
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
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")