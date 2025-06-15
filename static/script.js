document.addEventListener('DOMContentLoaded', () => {
    const pagePath = window.location.pathname;
    let uploadArea, input, browseBtn, startProcessingBtn, preview, progress, progressBar, progressText, resultDiv, clearButton, realSection, fakeSection, noFaceSection, realFiles, fakeFiles, noFaceFiles, modal, modalImage, modalVideo, modalInfo, closeModal, videoPlayer, videoElement, prevFrame, nextFrame, highlightCanvas, frameInfo, videoSelect;
    let highlightCtx;
    let fileBlobs = {};
    let allResults = {};
    let selectedFile = null;
    let analysisHistory = new Map(); // Store analysis results for each image

    if (pagePath === '/image') {
        uploadArea = document.getElementById('image-upload-area');
        input = document.getElementById('image-input');
        browseBtn = document.getElementById('image-browse');
        startProcessingBtn = document.getElementById('image-start-processing');
        preview = document.getElementById('image-preview');
        progress = document.getElementById('image-progress');
        progressBar = document.getElementById('image-progress-bar');
        progressText = document.getElementById('progress-percentage');
        resultDiv = document.getElementById('results-content');
        clearButton = document.getElementById('image-clear');
        realSection = document.getElementById('image-real-section');
        fakeSection = document.getElementById('image-fake-section');
        noFaceSection = document.getElementById('image-no-face-section');
        realFiles = document.getElementById('image-real-files');
        fakeFiles = document.getElementById('image-fake-files');
        noFaceFiles = document.getElementById('image-no-face-files');
        modal = document.getElementById('modal');
        modalImage = document.getElementById('modal-image');
        modalInfo = document.getElementById('modal-info');
        closeModal = document.querySelector('.close');
    } else if (pagePath === '/video') {
        uploadArea = document.getElementById('video-upload-area');
        input = document.getElementById('video-input');
        browseBtn = document.getElementById('video-browse');
        startProcessingBtn = document.getElementById('video-start-processing');
        preview = document.getElementById('video-preview');
        progress = document.getElementById('video-progress');
        progressBar = document.getElementById('video-progress-bar');
        progressText = document.getElementById('video-progress-text');
        resultDiv = document.getElementById('video-result');
        clearButton = document.getElementById('video-clear');
        realSection = document.getElementById('video-real-section');
        fakeSection = document.getElementById('video-fake-section');
        noFaceSection = document.getElementById('video-no-face-section');
        realFiles = document.getElementById('video-real-files');
        fakeFiles = document.getElementById('video-fake-files');
        noFaceFiles = document.getElementById('video-no-face-files');
        modal = document.getElementById('modal');
        modalVideo = document.getElementById('modal-video');
        modalInfo = document.getElementById('modal-info');
        closeModal = document.querySelector('.close');
        videoPlayer = document.getElementById('video-player');
        videoElement = document.getElementById('video-element');
        prevFrame = document.getElementById('prev-frame');
        nextFrame = document.getElementById('next-frame');
        highlightCanvas = document.getElementById('highlight-canvas');
        frameInfo = document.getElementById('frame-info');
        videoSelect = document.getElementById('video-select');
        highlightCtx = highlightCanvas.getContext('2d');
    } else {
        return;
    }

    let frameInterval = 1;
    let frameResults = {};

    function drawHighlight(faceBox, isFake) {
        if (!highlightCtx || !highlightCanvas || !videoElement) return;
        highlightCanvas.width = videoElement.videoWidth;
        highlightCanvas.height = videoElement.videoHeight;
        highlightCtx.clearRect(0, 0, highlightCanvas.width, highlightCanvas.height);
        if (faceBox) {
            const scaleX = highlightCanvas.width / videoElement.videoWidth;
            const scaleY = highlightCanvas.height / videoElement.videoHeight;
            highlightCtx.strokeStyle = isFake ? 'red' : 'green';
            highlightCtx.lineWidth = 4;
            highlightCtx.strokeRect(
                faceBox.x * scaleX,
                faceBox.y * scaleY,
                faceBox.width * scaleX,
                faceBox.height * scaleY
            );
        }
    }

    function updateFrameInfo(frameNumber) {
        if (!frameInfo) return;
        const frameResult = frameResults[frameNumber];
        if (frameResult && frameResult.face_detected) {
            const message = `This frame is ${frameResult.class} with ${(frameResult.confidence * 100).toFixed(2)}% confidence`;
            frameInfo.textContent = message;
            frameInfo.style.display = 'block';
        } else {
            frameInfo.style.display = 'none';
        }
    }

    async function loadVideoAndFrames() {
        if (!videoSelect || !videoElement || !frameInfo) return;
        const selectedVideo = videoSelect.value;
        if (!selectedVideo || !fileBlobs[selectedVideo]) {
            videoElement.src = '';
            frameInfo.style.display = 'none';
            return;
        }
        videoElement.src = URL.createObjectURL(fileBlobs[selectedVideo]);
        const results = await fetchResults();
        if (results[selectedVideo] && results[selectedVideo].frame_results) {
            frameResults = results[selectedVideo].frame_results.reduce((acc, frame) => {
                const frameNum = parseInt(frame.filename.split('_frame_')[1]);
                acc[frameNum] = frame;
                return acc;
            }, {});
        }
        videoElement.load();
        filterFramesByVideo();
    }

    function seekToFrame(frameNum) {
        if (!videoElement) return;
        const targetTime = frameNum * frameInterval;
        if (videoElement.readyState >= 2) {
            videoElement.currentTime = targetTime;
        } else {
            console.error(`Video not ready to seek to ${targetTime} seconds. Current readyState: ${videoElement.readyState}`);
            videoElement.addEventListener('loadedmetadata', () => {
                videoElement.currentTime = targetTime;
            }, { once: true });
        }
    }

    function validateFile(file) {
        const validImageExts = ['.jpg', '.jpeg', '.png'];
        const validVideoExts = ['.mp4', '.avi', '.mov', '.mkv'];
        const ext = '.' + file.name.split('.').pop().toLowerCase();
        console.log(`Validating file: ${file.name}, extension: ${ext}`);
        if (pagePath === '/image') {
            const isValid = validImageExts.includes(ext);
            console.log(`Image validation result: ${isValid}`);
            return isValid;
        } else {
            const isValid = validVideoExts.includes(ext);
            console.log(`Video validation result: ${isValid}`);
            return isValid;
        }
    }

    function handleFilePreview(files) {
        const thumbnailsContainer = document.getElementById('image-thumbnails');
        const imageCount = document.getElementById('image-count');
        const selectedImagePreview = document.getElementById('selected-image-preview');
        const selectedImage = document.getElementById('selected-image');
        const selectedImageName = document.getElementById('selected-image-name');
        
        thumbnailsContainer.innerHTML = '';
        preview.classList.add('hidden');
        startProcessingBtn.disabled = true;
        
        if (files.length > 0) {
            let validFiles = true;
            Array.from(files).forEach(file => {
                if (!validateFile(file)) {
                    showError(`Unsupported file type for ${file.name}`);
                    validFiles = false;
                    return;
                }
                fileBlobs[file.name] = file;
            });
            
            if (!validFiles) return;
            
            preview.classList.remove('hidden');
            startProcessingBtn.disabled = false;
            imageCount.textContent = files.length;
            
            Array.from(files).forEach((file, index) => {
                createThumbnail(file, index);
            });
            
            // Reinitialize Lucide icons
            lucide.createIcons();
        }
    }

    function createThumbnail(file, index) {
        const thumbnails = document.getElementById('image-thumbnails');
        const div = document.createElement('div');
        div.className = 'relative group cursor-pointer border-2 border-gray-200 rounded-lg overflow-hidden hover:border-blue-500 transition-all duration-200';
        div.style.width = '100px';
        div.style.height = '100px';
        div.style.overflow = 'hidden'; // Ensure content outside bounds is hidden for animation
        
        // Create image container (70% of height)
        const imgContainer = document.createElement('div');
        imgContainer.className = 'relative w-full';
        imgContainer.style.height = '70%';
        
        const img = document.createElement('img');
        img.src = URL.createObjectURL(file);
        img.alt = file.name;
        img.className = 'w-full h-full object-cover';
        
        // Create result container (30% of height) for centered text and animation
        const resultContainer = document.createElement('div');
        resultContainer.className = 'w-full h-full flex items-center justify-center relative'; // Added relative for absolute positioning of text
        resultContainer.style.height = '30%';
        resultContainer.style.backgroundColor = '#f8fafc'; // Initial background, will be overridden
        resultContainer.style.opacity = '0'; // Initial state for animation
        resultContainer.style.transform = 'translateY(100%)'; // Initial state for animation
        resultContainer.style.transition = 'all 0.5s ease-out'; // Smooth transition
        
        // Create an empty paragraph element for the result text
        const resultText = document.createElement('p');
        resultText.id = `result-${index}`;
        resultText.className = 'text-lg font-bold'; // Base classes, color set by updateResultsDisplay
        resultContainer.appendChild(resultText);
        
        // Add delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200';
        deleteBtn.innerHTML = '<i data-lucide="x" class="h-4 w-4"></i>';
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            removeImage(index);
        };
        
        imgContainer.appendChild(img);
        imgContainer.appendChild(deleteBtn);
        div.appendChild(imgContainer);
        div.appendChild(resultContainer);
        
        div.onclick = () => selectImage(file, index);
        thumbnails.appendChild(div);
        lucide.createIcons();
    }

    function selectImage(file, index) {
        const selectedImagePreview = document.getElementById('selected-image-preview');
        const selectedImage = document.getElementById('selected-image');
        const selectedImageName = document.getElementById('selected-image-name');
        
        selectedImagePreview.classList.remove('hidden');
        selectedImage.src = URL.createObjectURL(file);
        selectedImageName.textContent = file.name;
        startProcessingBtn.disabled = false;
        selectedFile = file;
        
        // Update thumbnail selection
        const thumbnails = document.querySelectorAll('#image-thumbnails > div');
        thumbnails.forEach((thumb, i) => {
            thumb.classList.toggle('border-blue-500', i === index);
        });

        // If this image has been analyzed before, show its results
        if (analysisHistory.has(file.name)) {
            updateResultsDisplay(file.name, analysisHistory.get(file.name));
        } else {
            // Show placeholder if image hasn't been analyzed
            resultDiv.innerHTML = `
                <div class="text-center py-12 text-gray-500">
                    <i data-lucide="shield" class="h-16 w-16 mx-auto mb-4 opacity-50"></i>
                    <p id="results-placeholder">Click "Analyze Image" to process this image</p>
                </div>
            `;
            lucide.createIcons();
        }
    }

    function removeImage(index) {
        const thumbnails = document.querySelectorAll('#image-thumbnails > div');
        if (thumbnails[index]) {
            const img = thumbnails[index].querySelector('img');
            if (img) {
                URL.revokeObjectURL(img.src);
                // Remove from analysis history
                const filename = img.alt;
                analysisHistory.delete(filename);
            }
            thumbnails[index].remove();
            
            // Update count
            const imageCount = document.getElementById('image-count');
            imageCount.textContent = parseInt(imageCount.textContent) - 1;
            
            // If no images left, hide preview and results
            if (parseInt(imageCount.textContent) === 0) {
                document.getElementById('image-preview').classList.add('hidden');
                document.getElementById('selected-image-preview').classList.add('hidden');
                startProcessingBtn.disabled = true;
                selectedFile = null;
                analysisHistory.clear(); // Clear analysis history
            }
        }
    }

    function showError(message) {
        const errorDiv = document.getElementById('error-message');
        const errorText = document.getElementById('error-text');
        errorText.textContent = message;
        errorDiv.classList.remove('hidden');
        setTimeout(() => {
            errorDiv.classList.add('hidden');
        }, 5000);
    }

    uploadArea.addEventListener('dragover', (e) => e.preventDefault());
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        const files = e.dataTransfer.files;
        input.files = files;
        handleFilePreview(files);
    });

    uploadArea.addEventListener('click', () => input.click());
    input.addEventListener('change', () => handleFilePreview(input.files));

    async function fetchResults() {
        try {
            const response = await fetch('/results');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('Error fetching results:', error.message);
            return {};
        }
    }

    async function showModal(filename, isPreview = false) {
        const imageConfidences = await fetchResults();
        const result = imageConfidences[filename];
        if (pagePath === '/image') {
            modalImage.src = isPreview ? URL.createObjectURL(fileBlobs[filename]) : `/uploads/${filename}`;
        } else {
            modalVideo.src = isPreview ? URL.createObjectURL(fileBlobs[filename]) : `/uploads/${filename}`;
        }
        modalInfo.innerHTML = result ? (
            result.no_face 
                ? `No face detected in ${filename}`
                : result.frame_results 
                    ? `Processed ${result.frame_results.length} frames.<br>Click frames below for details.`
                    : `Class: ${result.class}<br>Confidence: ${(result.confidence * 100).toFixed(2)}%<br>Face Detected: ${result.face_detected ? 'Yes' : 'No'}`
        ) : 'No results available';
        modal.style.display = 'flex';
    }

    closeModal.addEventListener('click', () => {
        modal.style.display = 'none';
        if (pagePath === '/image') {
            modalImage.src = '';
        } else {
            modalVideo.src = '';
        }
    });

    startProcessingBtn.addEventListener('click', async () => {
        if (!selectedFile) {
            showError('No image selected');
            return;
        }

        progress.classList.remove('hidden');
        startProcessingBtn.disabled = true;

        const formData = new FormData();
        formData.append('files', selectedFile);

        try {
        progressBar.style.width = '0%';
        progressText.textContent = '0%';

            console.log('Sending file to server:', selectedFile.name);
            const response = await fetch('/upload', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            console.log('Raw server response:', result);
            console.log('Confidence:', result.confidence);
            console.log('Face detected:', result.face_detected);
            console.log('Processing time:', result.processing_time);
            console.log('Class:', result.class);

            // Update progress bar to 100%
            progressBar.style.width = '100%';
            progressText.textContent = '100%';

            // Update results display
            updateResultsDisplay(selectedFile.name, result);

        } catch (error) {
            console.error('Error processing file:', error);
            showError(`Error processing ${selectedFile.name}: ${error.message}`);
        } finally {
            progress.classList.add('hidden');
            startProcessingBtn.disabled = false;
        }
    });

    function updateResultsDisplay(filename, result) {
        const resultsContent = document.getElementById('results-content');
        
        // Clear previous results
        resultsContent.innerHTML = '';

        // Store the result in analysis history
        analysisHistory.set(filename, result);

        // Update the thumbnail result text and styling
        const thumbnails = document.querySelectorAll('#image-thumbnails > div');
        thumbnails.forEach((thumb) => {
            const img = thumb.querySelector('img');
            if (img && img.alt === filename) {
                const resultContainer = thumb.querySelector('div:last-child');
                const resultText = resultContainer.querySelector('p');
                
                // Update result text and styling based on analysis result
                if (result.no_face) {
                    resultText.textContent = 'No Face';
                    resultText.className = 'text-lg font-bold text-yellow-500';
                    resultContainer.style.backgroundColor = '#fefcbf';
                } else if (result.class === 'real') {
                    resultText.textContent = 'Real';
                    resultText.className = 'text-lg font-bold text-white';
                    resultContainer.style.backgroundColor = '#22c55e';
                } else {
                    resultText.textContent = 'Fake';
                    resultText.className = 'text-lg font-bold text-white';
                    resultContainer.style.backgroundColor = '#ef4444';
                }
                
                // Trigger animation for the result text
                resultContainer.style.opacity = '1';
                resultContainer.style.transform = 'translateY(0)';
            }
        });

        // Main Result Card (replicated from image)
        const mainResultCard = document.createElement('div');
        mainResultCard.className = 'bg-white rounded-lg p-6 text-center';
        mainResultCard.innerHTML = `
            <div class="flex items-center justify-center mb-4">
                ${result.no_face 
                    ? '<i data-lucide="alert-triangle" class="h-16 w-16 text-yellow-500"></i>'
                    : result.class === 'real'
                        ? '<i data-lucide="check-circle" class="h-16 w-16 text-green-500"></i>'
                        : '<i data-lucide="alert-triangle" class="h-16 w-16 text-red-500"></i>'
                }
            </div>
            <h3 class="text-2xl font-bold mb-4">
                ${result.no_face 
                    ? 'No Face Detected'
                    : result.class === 'real'
                        ? 'Real Face Detected'
                        : 'Manipulated Face Detected'
                }
            </h3>
            <div class="inline-flex items-center px-4 py-2 bg-black text-white rounded-full text-lg font-semibold mb-6">
                ${result.confidence ? (result.confidence * 100).toFixed(1) : '0.0'}% Confidence
            </div>
        `;
        resultsContent.appendChild(mainResultCard);

        // Detailed statistics boxes
        const statsGrid = document.createElement('div');
        statsGrid.className = 'grid grid-cols-2 gap-4 mt-6';
        statsGrid.innerHTML = `
            <div class="text-center p-4 bg-blue-50 rounded-lg">
                <div class="text-2xl font-bold text-blue-600">${result.face_detected ? '1' : '0'}</div>
                <div class="text-sm text-gray-600">Face${result.face_detected ? '' : 's'} Detected</div>
            </div>
            <div class="text-center p-4 bg-purple-50 rounded-lg">
                <div class="text-2xl font-bold text-purple-600">${result.processing_time ? result.processing_time.toFixed(1) : '0.0'}s</div>
                <div class="text-sm text-gray-600">Processing Time</div>
            </div>
        `;
        resultsContent.appendChild(statsGrid);

        // Face Analysis section
        const faceAnalysisSection = document.createElement('div');
        faceAnalysisSection.className = 'mt-6 space-y-4';
        faceAnalysisSection.innerHTML = `
            <h3 class="text-xl font-semibold">Face Analysis</h3>
            <div class="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div class="flex items-center">
                    <span class="h-3 w-3 rounded-full ${result.class === 'real' ? 'bg-green-500' : 'bg-red-500'} mr-2"></span>
                    <span class="text-gray-800">Face 1</span>
                </div>
                <span class="text-sm font-medium text-gray-600">
                    ${result.class === 'real' ? 'Real' : 'Manipulated'} (${result.confidence ? (result.confidence * 100).toFixed(0) : '0'}%)
                </span>
            </div>
        `;
        // Only append if a face was detected, otherwise 'No Face Detected' handles it
        if (result.face_detected) {
            resultsContent.appendChild(faceAnalysisSection);
        }

        // Overall Confidence Level
        const overallConfidenceSection = document.createElement('div');
        overallConfidenceSection.className = 'mt-6 space-y-2';
        overallConfidenceSection.innerHTML = `
            <div class="flex justify-between text-sm">
                <h3 class="font-semibold">Overall Confidence Level</h3>
                <span>${result.confidence ? (result.confidence * 100).toFixed(1) : '0.0'}%</span>
            </div>
            <div class="w-full bg-gray-200 rounded-full h-2.5">
                <div class="h-2.5 rounded-full ${result.class === 'real' ? 'bg-green-500' : 'bg-red-500'}" style="width: ${result.confidence ? (result.confidence * 100) : 0}%"></div>
            </div>
        `;
        if (result.face_detected) {
            resultsContent.appendChild(overallConfidenceSection);
        }

        // Reinitialize Lucide icons
        lucide.createIcons();
    }

    function resetResultsDisplay() {
        resultDiv.innerHTML = `
            <div class="text-center py-12 text-gray-500">
                <i data-lucide="shield" class="h-16 w-16 mx-auto mb-4 opacity-50"></i>
                <p id="results-placeholder">Upload images to begin analysis</p>
            </div>
        `;
        lucide.createIcons();
    }

    clearButton.addEventListener('click', () => {
        // Clear all object URLs
        Object.values(fileBlobs).forEach(file => {
            URL.revokeObjectURL(URL.createObjectURL(file));
        });
        
        // Reset the file input
                input.value = '';
        
        // Clear the preview
                preview.classList.add('hidden');
        document.getElementById('image-thumbnails').innerHTML = '';
        document.getElementById('image-count').textContent = '0';
        
        // Hide selected image preview
        document.getElementById('selected-image-preview').classList.add('hidden');
        
        // Reset results display to initial placeholder
        resetResultsDisplay();
        
        // Reset state
        fileBlobs = {};
        selectedFile = null;
        analysisHistory.clear(); // Clear analysis history
        startProcessingBtn.disabled = true;
        
        // Reinitialize Lucide icons
        lucide.createIcons();
    });

    if (pagePath === '/video') {
        videoElement.addEventListener('loadedmetadata', () => {
            if (highlightCanvas) {
                highlightCanvas.width = videoElement.videoWidth;
                highlightCanvas.height = videoElement.videoHeight;
            }
        });

        videoElement.addEventListener('timeupdate', () => {
            if (highlightCanvas && videoElement) {
                if (highlightCanvas.width !== videoElement.videoWidth || highlightCanvas.height !== videoElement.videoHeight) {
                    highlightCanvas.width = videoElement.videoWidth;
                    highlightCanvas.height = videoElement.videoHeight;
                }
                const currentFrame = Math.floor(videoElement.currentTime * frameInterval);
                const frameResult = frameResults[currentFrame];
                if (frameResult && frameResult.face_detected) {
                    drawHighlight(frameResult.face_box, frameResult.class === 'fake');
                    updateFrameInfo(currentFrame);
                } else {
                    drawHighlight(null);
                    frameInfo.style.display = 'none';
                }
            }
        });

        prevFrame.addEventListener('click', () => {
            if (videoElement) {
                const currentTime = videoElement.currentTime;
                const newTime = Math.max(0, currentTime - frameInterval);
                videoElement.currentTime = newTime;
                updateFrameInfo(Math.floor(newTime * frameInterval));
            }
        });

        nextFrame.addEventListener('click', () => {
            if (videoElement) {
                const currentTime = videoElement.currentTime;
                videoElement.currentTime = currentTime + frameInterval;
                updateFrameInfo(Math.floor((currentTime + frameInterval) * frameInterval));
            }
        });

        videoSelect.addEventListener('change', () => {
            loadVideoAndFrames();
            filterFramesByVideo();
        });
    }

    updateResults();
});