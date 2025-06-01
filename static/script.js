document.addEventListener('DOMContentLoaded', () => {
    const pagePath = window.location.pathname;
    let uploadArea, input, browseBtn, preview, progress, progressBar, progressText, resultDiv, clearButton, realSection, fakeSection, noFaceSection, realFiles, fakeFiles, noFaceFiles, modal, modalImage, modalVideo, modalInfo, closeModal, videoPlayer, videoElement, prevFrame, nextFrame;

    // Initialize page-specific elements
    if (pagePath === '/image') {
        uploadArea = document.getElementById('image-upload-area');
        input = document.getElementById('image-input');
        browseBtn = document.getElementById('image-browse');
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
    } else {
        return; // Homepage doesn't need JavaScript
    }

    let fileBlobs = {};

    // Validate file formats
    function validateFile(file) {
        const validImageExts = ['.jpg', '.jpeg', '.png'];
        const validVideoExts = ['.mp4', '.avi', '.mov'];
        const ext = file.name.split('.').pop().toLowerCase();
        if (pagePath === '/image') {
            return validImageExts.includes('.' + ext);
        } else {
            return validVideoExts.includes('.' + ext);
        }
    }

    // Preview files before upload
    function handleFilePreview(files) {
        preview.innerHTML = '';
        preview.classList.add('hidden');
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

    // Drag-and-drop functionality
    uploadArea.addEventListener('dragover', (e) => e.preventDefault());
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        const files = e.dataTransfer.files;
        input.files = files;
        handleFilePreview(files);
    });

    // Browse button functionality
    browseBtn.addEventListener('click', () => input.click());
    input.addEventListener('change', () => handleFilePreview(input.files));

    // Fetch results
    async function fetchResults() {
        try {
            const response = await fetch('/results');
            return await response.json();
        } catch (error) {
            console.error('Error fetching results:', error);
            return {};
        }
    }

    // Show modal
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
                : `Class: ${result.class}<br>Confidence: ${(result.confidence * 100).toFixed(2)}%<br>Face Detected: ${result.face_detected ? 'Yes' : 'No'}`
        ) : 'No results available';
        modal.style.display = 'flex';
    }

    // Close modal
    closeModal.addEventListener('click', () => {
        modal.style.display = 'none';
        if (pagePath === '/image') {
            modalImage.src = '';
        } else {
            modalVideo.src = '';
        }
    });

    // Handle upload
    uploadArea.addEventListener('click', async (e) => {
        if (e.target.id === 'image-browse' || e.target.id === 'video-browse') return;
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
            const { processed, total } = data;
            if (total > 0) {
                const percentage = Math.round((processed / total) * 100);
                progressBar.style.width = `${percentage}%`;
                progressText.textContent = `${percentage}%`;
                if (processed >= total) {
                    eventSource.close();
                    progress.classList.add('hidden');
                    if (pagePath === '/video' && files.length === 1) {
                        videoPlayer.classList.remove('hidden');
                        videoElement.src = URL.createObjectURL(files[0]);
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

    // Update results
    async function updateResults() {
        try {
            const data = await fetchResults();
            realFiles.innerHTML = '';
            fakeFiles.innerHTML = '';
            noFaceFiles.innerHTML = '';
            realSection.classList.add('hidden');
            fakeSection.classList.add('hidden');
            noFaceSection.classList.add('hidden');

            if (Object.keys(data).length === 0) return;

            for (const [filename, result] of Object.entries(data)) {
                const ext = filename.split('.').pop().toLowerCase();
                const isImage = ['jpg', 'jpeg', 'png'].includes(ext);
                const isVideo = ['mp4', 'avi', 'mov'].includes(ext);
                if (pagePath === '/image' && !isImage) continue;
                if (pagePath === '/video' && !isVideo) continue;

                const container = document.createElement('div');
                container.className = 'file-item fade-in';
                let element;
                if (isImage) {
                    element = document.createElement('img');
                } else {
                    element = document.createElement('video');
                    element.muted = true;
                    element.controls = true;
                }
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
        } catch (error) {
            resultDiv.innerHTML = `<span class="text-red-600 fade-in">Error: Failed to fetch results</span>`;
        }
    }

    // Clear results
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
                if (pagePath === '/video') {
                    videoPlayer.classList.add('hidden');
                    videoElement.src = '';
                }
            } else {
                resultDiv.innerHTML = `<span class="text-red-600 fade-in">Error: ${data.error}</span>`;
            }
        } catch (error) {
            resultDiv.innerHTML = `<span class="text-red-600 fade-in">Error: Failed to clear results</span>`;
        }
    });

    // Video frame navigation (for Video Processing page)
    if (pagePath === '/video') {
        let frameInterval = 1; // 1 FPS (matches backend FRAME_RATE)
        prevFrame.addEventListener('click', () => {
            const currentTime = videoElement.currentTime;
            videoElement.currentTime = Math.max(0, currentTime - frameInterval);
        });
        nextFrame.addEventListener('click', () => {
            const currentTime = videoElement.currentTime;
            videoElement.currentTime = currentTime + frameInterval;
        });
    }

    // Load initial results
    updateResults();
});