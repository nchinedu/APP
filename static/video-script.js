document.addEventListener("DOMContentLoaded", () => {
    const uploadArea = document.getElementById("video-upload-area");
    const input = document.getElementById("video-input");
    const startProcessingBtn = document.getElementById("video-start-processing");
    const preview = document.getElementById("video-preview");
    const thumbnails = document.getElementById("video-thumbnails");
    const progress = document.getElementById("video-progress");
    const progressBar = document.getElementById("video-progress-bar");
    const progressText = document.getElementById("video-progress-text");
    const statusText = document.getElementById("video-status-text");
    const clearButton = document.getElementById("video-clear");
    const videoPlayer = document.getElementById("video-player");
    const videoElement = document.getElementById("video-element");
    const videoFilename = document.getElementById("video-filename");
    const highlightCanvas = document.getElementById("highlight-canvas");
    const modal = document.getElementById("modal");
    const modalVideo = document.getElementById("modal-video");
    const modalInfo = document.getElementById("modal-info");
    const closeModal = document.querySelector(".close");
    const uploadedVideosHeading = document.getElementById("uploaded-videos-heading");
    
    // New elements for Analysis Results
    const realFramesCount = document.getElementById("real-frames-count");
    const fakeFramesCount = document.getElementById("fake-frames-count");
    const averageConfidence = document.getElementById("average-confidence");
    const framesAnalyzed = document.getElementById("frames-analyzed");
    const processingTime = document.getElementById("processing-time");
    const selectedFrameNumber = document.getElementById("selected-frame-number");
    const selectedFrameTime = document.getElementById("selected-frame-time");
    const selectedFrameFaces = document.getElementById("selected-frame-faces");
    const selectedFrameClassification = document.getElementById("selected-frame-classification");
    const faceAnalysisDetails = document.getElementById("face-analysis-details");
    const frameTimeline = document.getElementById("frame-timeline");
    const overallVerdict = document.getElementById("overall-verdict");
    const analysisResultsSection = document.getElementById("analysis-results-section");
    const errorMessageDisplay = document.getElementById("error-message-display");

    let fileBlobs = {};
    let allResults = {};
    let selectedFiles = new Set();
    let currentlySelectedFile = null;
    let processedVideos = new Set();
    let frameInterval = 1;
    let frameResults = {};

    // File validation
    function validateFile(file) {
        const validVideoExts = [".mp4", ".avi", ".mov", ".mkv", ".webm"];
        const ext = "." + file.name.split(".").pop().toLowerCase();
        console.log(`Validating video file: ${file.name}, extension: ${ext}`);
        return validVideoExts.includes(ext);
    }

    // Handle file selection
    function handleFilePreview(files) {
        if (files.length > 0) {
            let validFiles = true;
            Array.from(files).forEach(file => {
                if (!validateFile(file)) {
                    showError(`Unsupported video format for ${file.name}`);
                    validFiles = false;
                    return;
                }
                fileBlobs[file.name] = file;
                selectedFiles.add(file.name);
            });
            
            if (!validFiles) return;
            
            preview.classList.remove("hidden");
            updateVideoCount();
            
            // Create preview for each video
            Array.from(files).forEach(file => {
                const div = document.createElement("div");
                div.className = "relative group cursor-pointer rounded-md overflow-hidden border-2 border-transparent hover:border-blue-500 transition-colors flex-shrink-0";
                div.style.width = "128px";
                div.style.height = "96px";
                div.style.minWidth = "128px";
                div.style.minHeight = "96px";
                
                const video = document.createElement("video");
                video.src = URL.createObjectURL(file);
                video.className = "w-full h-full object-cover";
                video.muted = true;
                
                const overlay = document.createElement("div");
                overlay.className = "absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center";
                overlay.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-8 w-8 text-white"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
                
                const removeBtn = document.createElement("button");
                removeBtn.className = "absolute top-1 right-1 bg-black/50 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity";
                removeBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-3 w-3 text-white"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
                removeBtn.onclick = (e) => {
                    e.stopPropagation();
                    removeVideo(file.name);
                };
                
                div.appendChild(video);
                div.appendChild(overlay);
                div.appendChild(removeBtn);
                thumbnails.appendChild(div);
                
                // Handle video selection
                div.addEventListener("click", () => {
                    selectVideo(file.name);
                });
            });
        }
    }

    // Update video count
    function updateVideoCount() {
        uploadedVideosHeading.textContent = `Uploaded Videos (${selectedFiles.size})`;
    }

    // Handle video selection
    function selectVideo(filename) {
        if (!fileBlobs[filename]) return;

        // Update selected state
        thumbnails.querySelectorAll("div").forEach(d => d.classList.remove("border-blue-500"));
        const selectedThumbnail = Array.from(thumbnails.querySelectorAll("div")).find(d => {
            const video = d.querySelector("video");
            return video && video.src.includes(filename);
        });
        if (selectedThumbnail) {
            selectedThumbnail.classList.add("border-blue-500");
        }

        // Update preview
        const file = fileBlobs[filename];
        videoElement.src = URL.createObjectURL(file);
        videoFilename.textContent = filename;
        videoPlayer.classList.remove("hidden");

        // Update currently selected file
        currentlySelectedFile = filename;

        // Enable analyze button if not already processed
        startProcessingBtn.disabled = processedVideos.has(filename);

        // Show results if video was processed
        if (processedVideos.has(filename)) {
            showResultsForVideo(filename);
            analysisResultsSection.classList.remove("hidden"); // Show analysis results section
        } else {
            // Clear results display if video hasn't been processed
            clearResultsDisplay();
            analysisResultsSection.classList.add("hidden"); // Hide analysis results section
        }
    }

    // Show results for specific video
    function showResultsForVideo(filename) {
        const results = allResults[filename];
        if (!results) {
            errorMessageDisplay.innerHTML = ''; // Clear previous general error messages
            showError("No results available for this video");
            return;
        }

        // Clear previous results display (specific analysis elements)
        clearResultsDisplay();

        // Populate Overall Metrics
        realFramesCount.textContent = results.real_frames || 0;
        fakeFramesCount.textContent = results.fake_frames || 0;
        averageConfidence.textContent = `${(results.average_confidence * 100).toFixed(1)}%`;
        framesAnalyzed.textContent = `${results.frames_analyzed || 0} / ${results.total_frames || 0}`;
        processingTime.textContent = `${results.processing_time ? results.processing_time.toFixed(2) : '0.00'}s`;

        // Populate Frame Analysis Timeline
        frameTimeline.innerHTML = "";
        if (results.frame_results && results.frame_results.length > 0) {
            results.frame_results.forEach((frame, index) => {
                const frameItem = document.createElement("div");
                frameItem.className = "grid grid-cols-3 gap-4 py-2 px-3 hover:bg-gray-50 cursor-pointer";
                frameItem.innerHTML = `
                    <div>Frame ${frame.frame_number !== undefined ? frame.frame_number : index}</div>
                    <div>${frame.processing_time ? frame.processing_time.toFixed(2) : '0.00'}s</div>
                    <div class="${frame.class === 'real' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'} px-2 py-0.5 rounded-full text-xs font-medium inline-block">
                        ${frame.class ? (frame.class.charAt(0).toUpperCase() + frame.class.slice(1)) : 'N/A'} (${(frame.confidence !== undefined ? frame.confidence * 100 : 0).toFixed(1)}%)
                    </div>
                `;
                frameItem.addEventListener("click", () => {
                    populateSelectedFrameDetails(frame);
                });
                frameTimeline.appendChild(frameItem);
            });
        }

        // Populate Overall Verdict
        overallVerdict.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-6 w-6 mr-2 ${results.overall_verdict === 'real' ? 'text-green-500' : 'text-red-500' || (results.overall_verdict === 'no_face' ? 'text-gray-500' : 'text-yellow-500')}"><polyline points="20 6 9 17 4 12"/></svg>
            <span>${results.overall_verdict === 'real' ? 'Mostly Real Content' : (results.overall_verdict === 'fake' ? 'Mostly Fake Content' : (results.overall_verdict === 'no_face' ? 'No Faces Detected' : 'Mixed Content'))}</span>
        `;
        overallVerdict.classList.remove("hidden");

        // Show analysis results section
        analysisResultsSection.classList.remove("hidden");

        // Populate initial selected frame details (e.g., first frame)
        if (results.frame_results && results.frame_results.length > 0) {
            populateSelectedFrameDetails(results.frame_results[0]);
        }
    }

    // Populate Selected Frame Details
    function populateSelectedFrameDetails(frame) {
        // Extract frame number from filename if not directly available
        const frameNumber = frame.frame_number !== undefined ? frame.frame_number : 
            (frame.filename ? parseInt(frame.filename.split('_frame_')[1]) - 1 : 'N/A');
        
        selectedFrameNumber.textContent = frameNumber;
        selectedFrameTime.textContent = frame.processing_time ? `${frame.processing_time.toFixed(2)}s` : 'N/A';
        selectedFrameFaces.textContent = frame.face_detected ? 'True' : 'False';
        selectedFrameClassification.textContent = frame.class ? frame.class.charAt(0).toUpperCase() + frame.class.slice(1) : 'N/A';
        selectedFrameClassification.className = `font-medium px-2 py-0.5 rounded-full text-white ${frame.class === 'real' ? 'bg-green-500' : 'bg-red-500'}`;

        faceAnalysisDetails.innerHTML = "";
        if (frame.face_analysis && frame.face_analysis.length > 0) {
            frame.face_analysis.forEach((face, index) => {
                const faceDiv = document.createElement("div");
                faceDiv.className = "flex justify-between items-center";
                faceDiv.innerHTML = `
                    <div class="flex items-center">
                        <span class="h-2 w-2 rounded-full mr-2 ${face.class === 'real' ? 'bg-green-500' : 'bg-red-500'}"></span>
                        <span>Face ${index + 1}</span>
                    </div>
                    <span class="${face.class === 'real' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'} px-2 py-0.5 rounded-full text-xs font-medium">
                        ${face.class ? (face.class.charAt(0).toUpperCase() + face.class.slice(1)) : 'N/A'} (${(face.confidence !== undefined ? face.confidence * 100 : 0).toFixed(1)}%)
                    </span>
                `;
                faceAnalysisDetails.appendChild(faceDiv);
            });
        } else {
            faceAnalysisDetails.innerHTML = '<div class="text-gray-500">No face analysis available</div>';
        }
    }

    // Clear results display
    function clearResultsDisplay() {
        // Clear specific analysis result elements
        realFramesCount.textContent = "0";
        fakeFramesCount.textContent = "0";
        averageConfidence.textContent = "0%";
        framesAnalyzed.textContent = "0 / 0";
        processingTime.textContent = "0s";
        selectedFrameNumber.textContent = "N/A";
        selectedFrameTime.textContent = "N/A";
        selectedFrameFaces.textContent = "N/A";
        selectedFrameClassification.textContent = "N/A";
        selectedFrameClassification.className = "font-medium px-2 py-0.5 rounded-full text-white"; // Reset class
        faceAnalysisDetails.innerHTML = "";
        frameTimeline.innerHTML = "";
        overallVerdict.innerHTML = "";
        analysisResultsSection.classList.add("hidden"); // Hide the main analysis results section

        // Clear general error messages
        errorMessageDisplay.innerHTML = "";
    }

    // Error handling
    function showError(message) {
        const errorDiv = document.createElement("div");
        errorDiv.className = "bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4";
        errorDiv.innerHTML = `
            <div class="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4 mr-2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>
                <span>${message}</span>
            </div>
        `;
        errorMessageDisplay.innerHTML = ""; // Clear previous errors
        errorMessageDisplay.appendChild(errorDiv);
    }

    // Fetch results from server
    async function fetchResults() {
        try {
            const response = await fetch("/results");
            if (!response.ok) {
                throw new Error(`Server returned ${response.status}: ${response.statusText}`);
            }
            const data = await response.json();
            console.log("Raw results from server:", data);
            return data;
        } catch (error) {
            console.error("Error fetching results:", error);
            showError("Failed to fetch results from server");
            return null;
        }
    }

    // Clear results
    function clearResults() {
        fetch('/clear', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Clear all UI elements
                resetResultsDisplay();
                
                // Clear thumbnails
                thumbnails.innerHTML = '';
                
                // Clear video player
                videoPlayer.classList.add("hidden");
                videoElement.src = "";
                videoFilename.textContent = "";
                
                // Reset progress
                progress.classList.add("hidden");
                progressBar.style.width = "0%";
                progressText.textContent = "0%";
                statusText.textContent = "";
                
                // Reset button state
                startProcessingBtn.disabled = true;
                
                // Clear file storage
                fileBlobs = {};
                allResults = {};
                frameResults = {};
                selectedFiles.clear();
                processedVideos.clear();
                currentlySelectedFile = null;
                
                // Update the video count display
                updateVideoCount();

                // Show success message
                const successDiv = document.createElement('div');
                successDiv.className = 'bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4';
                successDiv.innerHTML = `
                    <div class="flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4 mr-2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                        <span>${data.message}</span>
                    </div>
                `;
                errorMessageDisplay.innerHTML = ''; // Clear previous errors
                errorMessageDisplay.appendChild(successDiv);
        } else {
                showError(data.error || 'Failed to clear results');
            }
        })
        .catch(error => {
            console.error('Error clearing results:', error);
            showError('Failed to clear results');
        });
    }

    // Reset display
    function resetResultsDisplay() {
        // Clear specific analysis result elements
        realFramesCount.textContent = "0";
        fakeFramesCount.textContent = "0";
        averageConfidence.textContent = "0%";
        framesAnalyzed.textContent = "0 / 0";
        processingTime.textContent = "0s";
        selectedFrameNumber.textContent = "N/A";
        selectedFrameTime.textContent = "N/A";
        selectedFrameFaces.textContent = "N/A";
        selectedFrameClassification.textContent = "N/A";
        selectedFrameClassification.className = "font-medium px-2 py-0.5 rounded-full text-white"; // Reset class
        faceAnalysisDetails.innerHTML = "";
        frameTimeline.innerHTML = "";
        overallVerdict.innerHTML = "";
        analysisResultsSection.classList.add("hidden"); // Hide the main analysis results section

        // Clear general error messages
        errorMessageDisplay.innerHTML = "";

        preview.classList.add("hidden");
        videoPlayer.classList.add("hidden");
        startProcessingBtn.disabled = true;
        input.value = "";
        fileBlobs = {};
        allResults = {};
        frameResults = {};
        selectedFiles.clear();
        processedVideos.clear();
        currentlySelectedFile = null;
        if (videoElement) {
            videoElement.src = "";
        }
        updateVideoCount(); // Update count on full reset
    }

    // Event Listeners
    uploadArea.addEventListener("click", (e) => {
        if (e.target === uploadArea) {
            e.preventDefault();
            input.click();
        }
    });
    
    input.addEventListener("change", (e) => {
        e.preventDefault();
        if (e.target.files.length > 0) {
            handleFilePreview(e.target.files);
        }
    });
    
    clearButton.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        clearResults();
    });

    // Drag and drop handlers
    uploadArea.addEventListener("dragover", (e) => {
        e.preventDefault();
        uploadArea.classList.add("border-blue-500");
    });

    uploadArea.addEventListener("dragleave", (e) => {
        e.preventDefault();
        uploadArea.classList.remove("border-blue-500");
    });

    uploadArea.addEventListener("drop", (e) => {
        e.preventDefault();
        uploadArea.classList.remove("border-blue-500");
        handleFilePreview(e.dataTransfer.files);
    });

    // Start processing
    startProcessingBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (!currentlySelectedFile || !fileBlobs[currentlySelectedFile]) {
            showError("Please select a video to process");
            return;
        }

        // Clear previous general error messages before processing new video
        errorMessageDisplay.innerHTML = "";
        // Hide the analysis results section while processing
        analysisResultsSection.classList.add("hidden");

        const file = fileBlobs[currentlySelectedFile];
        const formData = new FormData();
        formData.append("files", file);

        progress.classList.remove("hidden");
        startProcessingBtn.disabled = true;
        progressBar.style.width = "0%";
        progressText.textContent = "0%";
        statusText.textContent = `Processing ${currentlySelectedFile}...`;

        let eventSource = null;

        try {
            const response = await fetch("/upload", {
                method: "POST",
                body: formData
            });

            if (!response.ok) {
                throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
            }

            // Start progress monitoring
        eventSource = new EventSource("/progress");
            
        eventSource.onmessage = (event) => {
            try {
                    const data = JSON.parse(event.data);
                    console.log("Progress update:", data);
                    
                    if (data.progress !== undefined) {
                        progressBar.style.width = `${data.progress}%`;
                        progressText.textContent = `${data.progress}%`;
                        
                        if (data.progress === 100) {
                            eventSource.close();
                            // Wait a bit for server to finish processing
                            setTimeout(async () => {
                                try {
                                    await updateResultsDisplay();
                                } catch (error) {
                                    console.error("Error updating results:", error);
                                    showError("Failed to display results. Please try again.");
                                }
                            }, 2000);
                        }
                    }
                } catch (error) {
                    console.error("Error parsing progress data:", error);
                }
            };

            eventSource.onerror = (error) => {
                console.error("EventSource error:", error);
                if (eventSource) {
                    eventSource.close();
                }
                // Don't show error here, as it might be normal closure
                // Instead, try to fetch results directly
                setTimeout(async () => {
                    try {
                        await updateResultsDisplay();
                    } catch (error) {
                        console.error("Error updating results after EventSource error:", error);
                        showError("Error processing video. Please try again.");
                    }
                }, 2000);
            };

        } catch (error) {
            console.error("Error uploading files:", error);
            showError("Failed to upload files. Please try again.");
            progress.classList.add("hidden");
            startProcessingBtn.disabled = false;
            if (eventSource) {
                eventSource.close();
            }
        }
    });

    // Update results display
    async function updateResultsDisplay() {
        try {
            console.log("Fetching results...");
            const results = await fetchResults();
            console.log("Received results:", results);

            if (!results) {
                showError("No results received from server");
                return;
            }

            // Get results for the currently selected video
            const videoResults = results[currentlySelectedFile];
            if (!videoResults) {
                showError("No results found for this video");
                return;
            }

            // Check if we have frame results
            if (!videoResults.frame_results || !Array.isArray(videoResults.frame_results) || videoResults.frame_results.length === 0) {
                showError("No frames were processed successfully. Please try again.");
                return;
            }

            // Store results for the processed video
            allResults[currentlySelectedFile] = videoResults;
            processedVideos.add(currentlySelectedFile);

            // Show results for the processed video
            showResultsForVideo(currentlySelectedFile);

            progress.classList.add("hidden");
            startProcessingBtn.disabled = true; // Disable analyze button for processed video
        } catch (error) {
            console.error("Error updating results display:", error);
            showError("Failed to update results display. Please try again.");
            progress.classList.add("hidden");
            startProcessingBtn.disabled = false;
        }
    }

    // Initial update of video count
    updateVideoCount();
});

// Remove video
function removeVideo(filename) {
    delete fileBlobs[filename];
    selectedFiles.delete(filename);
    processedVideos.delete(filename);
    delete allResults[filename];
    
    // If the removed video was selected, clear selection
    if (currentlySelectedFile === filename) {
        currentlySelectedFile = null;
        videoPlayer.classList.add("hidden");
        videoElement.src = "";
        startProcessingBtn.disabled = true;
        clearResultsDisplay();
    }
    
    // Remove the thumbnail
    const thumbnails = document.querySelectorAll("#video-thumbnails > div");
    thumbnails.forEach(div => {
        const video = div.querySelector("video");
        if (video && video.src.includes(filename)) {
            URL.revokeObjectURL(video.src);
            div.remove();
        }
    });
    
    // If no videos left, reset the UI
    if (selectedFiles.size === 0) {
        preview.classList.add("hidden");
        videoPlayer.classList.add("hidden");
        videoElement.src = "";
        startProcessingBtn.disabled = true;
        clearResultsDisplay();
    }
    updateVideoCount();
}