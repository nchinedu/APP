from flask import Flask, request, jsonify, send_from_directory, Response, render_template
import tensorflow as tf
import numpy as np
from PIL import Image
import os
import json
import cv2
import tempfile
import shutil
import logging

app = Flask(__name__)

# Setup logging
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(message)s')

# Load the TFLite model and allocate tensors
try:
    interpreter = tf.lite.Interpreter(model_path="xceptionnet_optimized.tflite")
    interpreter.allocate_tensors()
except Exception as e:
    app.logger.error(f"Failed to load TFLite model: {str(e)}")
    raise

# Get input and output tensors
input_details = interpreter.get_input_details()
output_details = interpreter.get_output_details()

# Create directories for uploaded files and temporary frames
UPLOAD_FOLDER = 'uploads'
TEMP_FOLDER = 'TempFrames'
for folder in [UPLOAD_FOLDER, TEMP_FOLDER]:
    if not os.path.exists(folder):
        os.makedirs(folder)

# Dictionary to store confidences and progress
image_confidences = {}
progress_data = {'processed': 0, 'total': 0, 'status': ''}

def update_progress(processed, total, status=''):
    global progress_data
    progress_data['processed'] = processed
    progress_data['total'] = total
    progress_data['status'] = status

# Configuration
THRESHOLD = 0.3
LABEL_MAPPING = 'real_high'
FRAME_RATE = 1
MAX_FRAMES = 30
ALLOWED_IMAGE_EXTS = {'.jpg', '.jpeg', '.png'}
ALLOWED_VIDEO_EXTS = {'.mp4', '.avi', '.mov', '.mkv'}

# Load Haar Cascade for face detection
face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
if face_cascade.empty():
    app.logger.error("Failed to load Haar Cascade classifier")
    raise RuntimeError("Failed to load Haar Cascade classifier")

def detect_and_crop_face(img_array):
    try:
        gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY)
        faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))
        
        if len(faces) > 0:
            largest_face = max(faces, key=lambda f: f[2] * f[3])
            x, y, w, h = largest_face
            padding = int(max(w, h) * 0.2)
            x = max(0, x - padding)
            y = max(0, y - padding)
            w = min(img_array.shape[1] - x, w + 2 * padding)
            h = min(img_array.shape[0] - y, h + 2 * padding)
            face_img = img_array[y:y+h, x:x+w]
            face_img = cv2.resize(face_img, (299, 299))
            return face_img, True, {'x': int(x), 'y': int(y), 'width': int(w), 'height': int(h)}
        else:
            return cv2.resize(img_array, (299, 299)), False, None
    except Exception as e:
        app.logger.error(f"Error in detect_and_crop_face: {str(e)}")
        raise

def process_image(img_array, filename):
    try:
        processed_img, face_detected, face_box = detect_and_crop_face(img_array)
        
        if not face_detected:
            return {
                'filename': filename,
                'no_face': True
            }
        
        img_array = np.array(processed_img, dtype=np.float32)
        img_array = (img_array / 127.5) - 1.0
        img_array = np.expand_dims(img_array, axis=0)

        interpreter.set_tensor(input_details[0]['index'], img_array)
        interpreter.invoke()
        output_data = interpreter.get_tensor(output_details[0]['index'])
        score = output_data[0][0]

        if LABEL_MAPPING == 'real_high':
            predicted_class = 'real' if score > THRESHOLD else 'fake'
            confidence = score if predicted_class == 'real' else 1.0 - score
        else:
            predicted_class = 'fake' if score > THRESHOLD else 'real'
            confidence = score if predicted_class == 'fake' else 1.0 - score

        return {
            'filename': filename,
            'class': predicted_class,
            'confidence': float(confidence),
            'face_detected': face_detected,
            'face_box': face_box,
            'no_face': False
        }
    except Exception as e:
        app.logger.error(f"Error processing image {filename}: {str(e)}")
        return {'error': f"Failed to process image: {str(e)}", 'filename': filename}

def process_video(file):
    try:
        video_path = os.path.join(UPLOAD_FOLDER, file.filename)
        file.save(video_path)
        app.logger.debug(f"Saved video: {video_path}")

        temp_dir = tempfile.mkdtemp(dir=TEMP_FOLDER)
        frame_results = []

        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            return {'error': f'Cannot open video {file.filename}', 'filename': file.filename}

        # Get total frame count for progress tracking
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        fps = cap.get(cv2.CAP_PROP_FPS)
        frame_interval = int(fps / FRAME_RATE) if fps > 0 else 1
        estimated_frames = min(MAX_FRAMES, total_frames // frame_interval)
        frame_count = 0

        # Pre-extract frames to reduce I/O overhead
        frames_to_process = []
        frame_paths = []

        update_progress(0, 100, 'Extracting frames...')

        while cap.isOpened() and frame_count < MAX_FRAMES:
            ret, frame = cap.read()
            if not ret:
                break

            if cap.get(cv2.CAP_PROP_POS_FRAMES) % frame_interval == 0:
                frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                current_frame = int(cap.get(cv2.CAP_PROP_POS_FRAMES) / frame_interval)
                frame_filename = f"{file.filename}_frame_{current_frame}"
                frame_path = os.path.join(TEMP_FOLDER, f"{frame_filename}.jpg")
                
                # Save frame for display
                cv2.imwrite(frame_path, cv2.cvtColor(frame_rgb, cv2.COLOR_RGB2BGR))
                
                frames_to_process.append((frame_rgb, frame_filename))
                frame_paths.append(frame_path)
                frame_count += 1

                # Update progress for frame extraction (0-50%)
                extraction_progress = int((frame_count / estimated_frames) * 50)
                update_progress(extraction_progress, 100, f'Extracting frame {frame_count}/{estimated_frames}')

        cap.release()

        # Process extracted frames
        update_progress(50, 100, 'Processing frames...')
        total_frames = len(frames_to_process)

        for idx, (frame_rgb, frame_filename) in enumerate(frames_to_process, 1):
            result = process_image(frame_rgb, frame_filename)
            frame_results.append(result)
            
            # Update progress for frame processing (50-100%)
            processing_progress = 50 + int((idx / total_frames) * 50)
            update_progress(processing_progress, 100, f'Processing frame {idx}/{total_frames}')


        if not any(r.get('face_detected', False) for r in frame_results):
            return {
                'filename': file.filename,
                'no_face': True
            }

        return {
            'filename': file.filename,
            'frame_results': frame_results
        }

    except Exception as e:
        app.logger.error(f"Error processing video {file.filename}: {str(e)}")
        return {'error': str(e), 'filename': file.filename}
    finally:
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)

@app.route('/')
def serve_home():
    return render_template('homepage.html')

@app.route('/image')
def serve_image_processing():
    return render_template('image-processing.html')

@app.route('/video')
def serve_video_processing():
    return render_template('video-processing.html')

@app.route('/uploads/<filename>')
def serve_uploaded_file(filename):
    file_path = os.path.join(UPLOAD_FOLDER, filename)
    if os.path.exists(file_path):
        return send_from_directory(UPLOAD_FOLDER, filename)
    else:
        app.logger.error(f"File not found: {file_path}")
        return jsonify({'error': 'File not found'}), 404

@app.route('/TempFrames/<filename>')
def serve_temp_frame(filename):
    file_path = os.path.join(TEMP_FOLDER, filename)
    if os.path.exists(file_path):
        return send_from_directory(TEMP_FOLDER, filename)
    else:
        app.logger.error(f"Frame not found: {file_path}")
        return jsonify({'error': 'Frame not found'}), 404

@app.route('/progress')
def progress():
    def generate():
        while True:
            yield f"data: {json.dumps(progress_data)}\n\n"
            import time
            time.sleep(0.1)
    return Response(generate(), mimetype='text/event-stream')

@app.route('/upload', methods=['POST'])
def upload_files():
    global progress_data
    if 'files' not in request.files:
        return jsonify({'error': 'No files provided'}), 400

    files = request.files.getlist('files')
    if not files or all(file.filename == '' for file in files):
        return jsonify({'error': 'No files selected'}), 400

    total_files = len(files)
    results = []

    for idx, file in enumerate(files, 1):
        if file and file.filename:
            file_ext = os.path.splitext(file.filename)[1].lower()
            if file_ext in ALLOWED_IMAGE_EXTS:
                try:
                    update_progress(((idx - 1) * 100) // total_files, 100, f'Processing image {idx}/{total_files}: {file.filename}')
                    file_path = os.path.join(UPLOAD_FOLDER, file.filename)
                    file.save(file_path)
                    app.logger.debug(f"Saved file: {file_path}")
                    img = Image.open(file_path).convert('RGB')
                    img_array = np.array(img)
                    result = process_image(img_array, file.filename)
                    results.append(result)
                    image_confidences[file.filename] = result
                except Exception as e:
                    app.logger.error(f"Error processing image {file.filename}: {str(e)}")
                    results.append({'error': f"Failed to process image: {str(e)}", 'filename': file.filename})
            elif file_ext in ALLOWED_VIDEO_EXTS:
                result = process_video(file)
                results.append(result)
                if 'error' not in result:
                    image_confidences[file.filename] = result
                else:
                    app.logger.error(f"Error in video result {file.filename}: {result['error']}")
            else:
                results.append({'error': f'Unsupported file type: {file_ext}', 'filename': file.filename})
            
            update_progress((idx * 100) // total_files, 100, f'Completed {idx}/{total_files} files')
            app.logger.debug(f"Progress: {idx}/{total_files}")

    try:
        with open('image_confidences.json', 'w') as f:
            json.dump(image_confidences, f, indent=4)
    except Exception as e:
        app.logger.error(f"Failed to save image_confidences.json: {str(e)}")
        return jsonify({'error': 'Failed to save results'}), 500

    return jsonify(results)

@app.route('/results')
def get_results():
    return jsonify(image_confidences)

@app.route('/clear', methods=['POST'])
def clear_results():
    global image_confidences, progress_data
    image_confidences = {}
    progress_data = {'processed': 0, 'total': 0}
    try:
        with open('image_confidences.json', 'w') as f:
            json.dump(image_confidences, f, indent=4)
        # Clear TempFrames directory
        for file in os.listdir(TEMP_FOLDER):
            file_path = os.path.join(TEMP_FOLDER, file)
            try:
                if os.path.isfile(file_path):
                    os.unlink(file_path)
            except Exception as e:
                app.logger.error(f"Error deleting frame file {file_path}: {str(e)}")
        return jsonify({'message': 'Results cleared successfully'})
    except Exception as e:
        app.logger.error(f"Error clearing results: {str(e)}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)