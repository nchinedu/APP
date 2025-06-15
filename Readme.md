# Deepfake Detection Application

This is a Flask-based web application for detecting deepfake images and videos using TensorFlow Lite. The application uses a pre-trained XceptionNet model optimized for edge devices.

## Features

- Image analysis for deepfake detection
- Video analysis with frame-by-frame processing
- Face detection and cropping
- Real-time progress tracking
- Support for multiple image formats (JPG, JPEG, PNG)
- Support for multiple video formats (MP4, AVI, MOV, MKV)

## Prerequisites

- Python 3.10 or higher
- pip (Python package installer)

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd <repository-name>
```

2. Create and activate a virtual environment:
```bash
python -m venv venv
# On Windows
.\venv\Scripts\activate
# On Unix/MacOS
source venv/bin/activate
```

3. Install the required dependencies:
```bash
pip install -r requirements.txt
```

## Usage

1. Start the Flask application:
```bash
python app.py
```

2. Open your web browser and navigate to:
```
http://localhost:5000
```

3. Use the web interface to:
   - Upload images or videos for analysis
   - View real-time processing progress
   - Get detailed results with confidence scores

## API Endpoints

- `/` - Home page
- `/image` - Image processing interface
- `/video` - Video processing interface
- `/upload` - POST endpoint for file uploads
- `/progress` - GET endpoint for processing progress
- `/results` - GET endpoint for analysis results
- `/clear` - POST endpoint to clear results

## Model Information

The application uses a TensorFlow Lite model (`xceptionnet_optimized.tflite`) optimized for edge devices. The model is trained to detect deepfakes with the following characteristics:

- Input size: 299x299 pixels
- Confidence threshold: 0.3
- Face detection using Haar Cascade classifier

## Project Structure

```
├── app.py              # Main Flask application
├── requirements.txt    # Python dependencies
├── xceptionnet_optimized.tflite  # TensorFlow Lite model
├── uploads/           # Directory for uploaded files
├── TempFrames/        # Directory for temporary video frames
├── static/           # Static files (CSS, JS, images)
└── templates/        # HTML templates
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- TensorFlow and TensorFlow Lite for the machine learning framework
- OpenCV for image and video processing
- Flask for the web framework
