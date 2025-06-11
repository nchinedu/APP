document.addEventListener('DOMContentLoaded', () => {
    const pagePath = window.location.pathname;
    let uploadArea, input, browseBtn, startProcessingBtn, preview, progress, progressBar, progressText, resultDiv, clearButton, realSection, fakeSection, noFaceSection, realFiles, fakeFiles, noFaceFiles, modal, modalImage, modalVideo, modalInfo, closeModal, videoPlayer, videoElement, prevFrame, nextFrame, highlightCanvas, frameInfo, videoSelect;
    let highlightCtx;
    let fileBlobs = {};
    let allResults = {};

    if (pagePath === '/image') {
        uploadArea = document.getElementById('image-upload-area');
        input = document.getElementById('image-input');
        browseBtn = document.getElementById('image-browse');
        startProcessingBtn = document.getElementById('image-start-processing');
        preview = document.getElementById('image-preview');
        progress = document.getElementById('image-progress');
        progressBar = document.getElementById('image-progress-bar');
        progressText = document.getElementById('image-progress-text');
        resultDiv = document.getElementById('image-result');
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
        preview.innerHTML = '';
        preview.classList.add('hidden');
        startProcessingBtn.disabled = true;
        if (files.length > 0) {
            let validFiles = true;
            Array.from(files).forEach(file => {
                if (!validateFile(file)) {
                    resultDiv.innerHTML = `<span class="text-red-600 fade-in">Error: Unsupported file type for ${file.name}</span>`;
                    validFiles = false;
                    return;
                }
                fileBlobs[file.name] = file;
            });
            if (!validFiles) return;
            preview.classList.remove('hidden');
            startProcessingBtn.disabled = false;
            Array.from(files).forEach(file => {
                const container = document.createElement('div');
                container.className = 'file-item';
                let element;
                if (file.type.startsWith('image/')) {
                    element = document.createElement('img');
                    element.src = URL.createObjectURL(file);
                } else if (file.type.startsWith('video/')) {
                    element = document.createElement('video');
                    element.src = URL.createObjectURL(file);
                    element.muted = true;
                    element.controls = true;
                }
                element.alt = file.name;
                element.title = file.name;
                element.className = 'w-full h-32 object-cover rounded-lg';
                element.dataset.filename = file.name;
                element.addEventListener('click', () => showModal(file.name, true));
                container.appendChild(element);
                const filenameDiv = document.createElement('div');
                filenameDiv.className = 'text-sm text-gray-600 mt-2 truncate';
                filenameDiv.textContent = file.name;
                container.appendChild(filenameDiv);
                preview.appendChild(container);
            });
        }
        resultDiv.innerHTML = '';
    }

    uploadArea.addEventListener('dragover', (e) => e.preventDefault());
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        const files = e.dataTransfer.files;
        input.files = files;
        handleFilePreview(files);
    });

    browseBtn.addEventListener('click', () => input.click());
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
        const files = input.files;
        if (files.length === 0) {
            resultDiv.innerHTML = `<span class="text-red-600 fade-in">No files selected</span>`;
            return;
        }
        let validFiles = true;
        Array.from(files).forEach(file => {
            if (!validateFile(file)) {
                resultDiv.innerHTML = `<span class="text-red-600 fade-in">Error: Unsupported file type for ${file.name}</span>`;
                validFiles = false;
            }
        });
        if (!validFiles) return;

        const formData = new FormData();
        Array.from(files).forEach(file => formData.append('files', file));

        progress.classList.remove('hidden');
        progressBar.style.width = '0%';
        progressText.textContent = '0%';

        const eventSource = new EventSource('/progress');
        eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);
            const { processed, total, status } = data;
            if (total > 0) {
                const percentage = Math.round((processed / total) * 100);
                progressBar.style.width = `${percentage}%`;
                progressText.textContent = `${percentage}%`;
                
                // Update status message if available
                const statusText = document.getElementById(pagePath === '/video' ? 'video-status-text' : 'image-status-text');
                if (statusText && status) {
                    statusText.textContent = status;
                }

                if (processed >= total) {
                    eventSource.close();
                    progress.classList.add('hidden');
                    if (pagePath === '/video' && files.length > 0) {
                        videoPlayer.classList.remove('hidden');
                        loadVideoAndFrames();
                    }
                }
            }
        };
        eventSource.onerror = () => {
            eventSource.close();
            progress.classList.add('hidden');
            resultDiv.innerHTML = `<span class="text-red-600 fade-in">Error: Failed to receive progress updates</span>`;
        };

        try {
            const response = await fetch('/upload', { method: 'POST', body: formData });
            const data = await response.json();
            if (response.ok) {
                resultDiv.innerHTML = `<span class="fade-in">Processed ${data.length} file(s).</span>`;
                updateResults();
                const errors = data.filter(r => r.error);
                if (errors.length > 0) {
                    resultDiv.innerHTML += `<br><span class="text-red-600 fade-in">Errors: ${errors.map(e => e.error).join(', ')}</span>`;
                }
            } else {
                throw new Error(data.error || 'Upload failed');
            }
        } catch (error) {
            eventSource.close();
            progress.classList.add('hidden');
            resultDiv.innerHTML = `<span class="text-red-600 fade-in">Error: ${error.message}</span>`;
        }
    });

    async function updateResults() {
        try {
            const data = await fetchResults();
            allResults = data;
            if (pagePath === '/video' && videoSelect) {
                videoSelect.innerHTML = '<option value="">Select a Video</option>';
            }
            for (const [filename, result] of Object.entries(data)) {
                const ext = filename.split('.').pop().toLowerCase();
                const isImage = ['jpg', 'jpeg', 'png'].includes(ext);
                const isVideo = ['mp4', 'avi', 'mov', 'mkv'].includes(ext);

                if (pagePath === '/image' && !isImage) continue;
                if (pagePath === '/video' && !isVideo) continue;

                if (isImage) {
                    const container = document.createElement('div');
                    container.className = 'file-item fade-in';
                    const element = document.createElement('img');
                    element.src = `/uploads/${filename}`;
                    element.alt = filename;
                    element.title = filename;
                    element.className = 'w-full h-32 object-cover rounded-lg';
                    element.dataset.filename = filename;
                    element.onerror = () => {
                        console.error(`Failed to load media: /uploads/${filename}`);
                        element.src = '';
                    };
                    element.addEventListener('click', () => showModal(filename));
                    container.appendChild(element);

                    const infoDiv = document.createElement('div');
                    infoDiv.className = 'text-sm text-gray-600 mt-2';
                    infoDiv.innerHTML = `<span class="truncate">${filename}</span>`;
                    if (!result.no_face) {
                        infoDiv.innerHTML += `<br>Confidence: ${(result.confidence * 100).toFixed(2)}%`;
                    }
                    container.appendChild(infoDiv);

                    if (result.no_face) {
                        noFaceSection.classList.remove('hidden');
                        noFaceFiles.appendChild(container);
                    } else if (result.class === 'real') {
                        realSection.classList.remove('hidden');
                        realFiles.appendChild(container);
                    } else {
                        fakeSection.classList.remove('hidden');
                        fakeFiles.appendChild(container);
                    }
                }

                if (isVideo && pagePath === '/video' && videoSelect) {
                    const option = document.createElement('option');
                    option.value = filename;
                    option.textContent = filename;
                    videoSelect.appendChild(option);
                }
            }
            if (pagePath === '/video') {
                filterFramesByVideo();
            }
        } catch (error) {
            resultDiv.innerHTML = `<span class="text-red-600 fade-in">Error: Failed to fetch results - ${error.message}</span>`;
        }
    }

    function filterFramesByVideo() {
        if (!realFiles || !fakeFiles || !noFaceFiles || !realSection || !fakeSection || !noFaceSection || !videoSelect) return;
        const selectedVideo = videoSelect.value;
        realFiles.innerHTML = '';
        fakeFiles.innerHTML = '';
        noFaceFiles.innerHTML = '';
        realSection.classList.add('hidden');
        fakeSection.classList.add('hidden');
        noFaceSection.classList.add('hidden');

        if (!selectedVideo) return;

        const result = allResults[selectedVideo];
        if (result && result.frame_results) {
            result.frame_results.forEach(frame => {
                const frameFilename = frame.filename;
                const container = document.createElement('div');
                container.className = 'file-item fade-in';
                const element = document.createElement('img');
                element.src = `/TempFrames/${frameFilename}.jpg`;
                element.alt = frameFilename;
                element.title = frameFilename;
                element.className = 'w-full h-32 object-cover rounded-lg';
                element.dataset.filename = frameFilename;
                element.dataset.video = selectedVideo;
                const confidence = frame.confidence * 100;
                if (confidence >= 90) {
                    element.style.backgroundColor = '#4CAF50'; // Darker green
                } else if (confidence >= 70) {
                    element.style.backgroundColor = '#FFCA28'; // Darker yellow
                } else {
                    element.style.backgroundColor = '#F44336'; // Darker red
                }
                element.onerror = () => {
                    console.error(`Failed to load frame: /TempFrames/${frameFilename}.jpg`);
                    element.src = '';
                };
                element.addEventListener('click', () => {
                    videoSelect.value = selectedVideo;
                    loadVideoAndFrames();
                    const frameNum = parseInt(frameFilename.split('_frame_')[1]);
                    seekToFrame(frameNum);
                });
                container.appendChild(element);

                const infoDiv = document.createElement('div');
                infoDiv.className = 'text-sm text-gray-600 mt-2';
                infoDiv.innerHTML = `<span class="truncate">Frame ${frameFilename.split('_frame_')[1]}</span>`;
                if (!frame.no_face) {
                    infoDiv.innerHTML += `<br>Confidence: ${(frame.confidence * 100).toFixed(2)}%`;
                }
                container.appendChild(infoDiv);

                if (frame.no_face) {
                    noFaceSection.classList.remove('hidden');
                    noFaceFiles.appendChild(container);
                } else if (frame.class === 'real') {
                    realSection.classList.remove('hidden');
                    realFiles.appendChild(container);
                } else {
                    fakeSection.classList.remove('hidden');
                    fakeFiles.appendChild(container);
                }
            });
        }
    }

    clearButton.addEventListener('click', async () => {
        try {
            const response = await fetch('/clear', { method: 'POST' });
            const data = await response.json();
            if (response.ok) {
                resultDiv.innerHTML = '<span class="fade-in">Results cleared.</span>';
                realSection.classList.add('hidden');
                fakeSection.classList.add('hidden');
                noFaceSection.classList.add('hidden');
                realFiles.innerHTML = '';
                fakeFiles.innerHTML = '';
                noFaceFiles.innerHTML = '';
                input.value = '';
                preview.innerHTML = '';
                preview.classList.add('hidden');
                fileBlobs = {};
                allResults = {};
                if (pagePath === '/video') {
                    videoPlayer.classList.add('hidden');
                    videoElement.src = '';
                    highlightCanvas.width = 0;
                    highlightCanvas.height = 0;
                    frameInfo.style.display = 'none';
                    videoSelect.innerHTML = '<option value="">Select a Video</option>';
                }
            } else {
                resultDiv.innerHTML = `<span class="text-red-600 fade-in">Error: ${data.error}</span>`;
            }
        } catch (error) {
            resultDiv.innerHTML = `<span class="text-red-600 fade-in">Error: Failed to clear results</span>`;
        }
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