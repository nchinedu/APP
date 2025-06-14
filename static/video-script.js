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
    const resultDiv = document.getElementById("video-result");
    const clearButton = document.getElementById("video-clear");
    const videoPlayer = document.getElementById("video-player");
    const videoElement = document.getElementById("video-element");
    const videoFilename = document.getElementById("video-filename");
    const highlightCanvas = document.getElementById("highlight-canvas");
    const realSection = document.getElementById("video-real-section");
    const fakeSection = document.getElementById("video-fake-section");
    const noFaceSection = document.getElementById("video-no-face-section");
    const realFiles = document.getElementById("video-real-files");
    const fakeFiles = document.getElementById("video-fake-files");
    const noFaceFiles = document.getElementById("video-no-face-files");
    const modal = document.getElementById("modal");
    const modalVideo = document.getElementById("modal-video");
    const modalInfo = document.getElementById("modal-info");
    const closeModal = document.querySelector(".close");

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
        } else {
            // Clear results display if video hasn't been processed
            clearResultsDisplay();
        }
    }

    // Show results for specific video
    function showResultsForVideo(filename) {
        const results = allResults[filename];
        if (!results) {
            showError("No results available for this video");
            return;
        }

        // Clear previous results
        clearResultsDisplay();

        // Check if we have frame results
        if (!results.frame_results || !Array.isArray(results.frame_results) || results.frame_results.length === 0) {
            showError("No frames were processed successfully for this video");
            return;
        }

        let hasResults = false;

        results.frame_results.forEach(frame => {
            if (!frame || !frame.filename) {
                console.warn("Invalid frame data:", frame);
                return;
            }

            hasResults = true;
            const frameDiv = createFrameElement(frame, filename);
            if (frame.no_face) {
                noFaceFiles.appendChild(frameDiv);
                noFaceSection.classList.remove("hidden");
            } else if (frame.class === "real") {
                realFiles.appendChild(frameDiv);
                realSection.classList.remove("hidden");
            } else {
                fakeFiles.appendChild(frameDiv);
                fakeSection.classList.remove("hidden");
            }
        });

        if (!hasResults) {
            showError("No valid frames were found in the results");
        }
    }

    // Clear results display
    function clearResultsDisplay() {
        realSection.classList.add("hidden");
        fakeSection.classList.add("hidden");
        noFaceSection.classList.add("hidden");
        realFiles.innerHTML = "";
        fakeFiles.innerHTML = "";
        noFaceFiles.innerHTML = "";
        resultDiv.innerHTML = "";
    }

    // Update the video selection handler
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
            
            // Create preview for each video
            Array.from(files).forEach(file => {
                const div = document.createElement("div");
                div.className = "relative group cursor-pointer rounded-md overflow-hidden border-2 border-transparent hover:border-blue-500 transition-colors";
                div.style.width = "128px";
                div.style.height = "96px";
                
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
        resultDiv.innerHTML = "";
        resultDiv.appendChild(errorDiv);
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
                
                // Show success message
                const successDiv = document.createElement('div');
                successDiv.className = 'bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4';
                successDiv.innerHTML = `
                    <div class="flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4 mr-2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                        <span>${data.message}</span>
                    </div>
                `;
                resultDiv.innerHTML = '';
                resultDiv.appendChild(successDiv);
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
        realSection.classList.add("hidden");
        fakeSection.classList.add("hidden");
        noFaceSection.classList.add("hidden");
        realFiles.innerHTML = "";
        fakeFiles.innerHTML = "";
        noFaceFiles.innerHTML = "";
        resultDiv.innerHTML = "";
        preview.classList.add("hidden");
        videoPlayer.classList.add("hidden");
        startProcessingBtn.disabled = true;
        input.value = "";
        fileBlobs = {};
        allResults = {};
        frameResults = {};
        selectedFiles.clear();
        if (videoElement) {
            videoElement.src = "";
        }
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

        // Clear previous results before processing new video
        clearResultsDisplay();

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

    // Create frame element
    function createFrameElement(frame, videoFilename) {
        const div = document.createElement("div");
        div.className = "relative group cursor-pointer rounded-lg overflow-hidden border border-gray-200 hover:border-blue-500 transition-colors";
        
        const img = document.createElement("img");
        img.src = `/TempFrames/${frame.filename}`;
        img.alt = frame.filename;
        img.className = "w-full h-48 object-cover";
        
        const overlay = document.createElement("div");
        overlay.className = "absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center";
        overlay.innerHTML = `
            <div class="text-white text-center">
                <div class="text-sm font-medium mb-1">Frame ${frame.filename.split("_frame_")[1]}</div>
                <div class="text-xs">Confidence: ${(frame.confidence * 100).toFixed(1)}%</div>
                <div class="text-xs">Class: ${frame.class}</div>
            </div>
        `;
        
        div.appendChild(img);
        div.appendChild(overlay);
        
        img.addEventListener("click", () => showModal(frame.filename));
        
        return div;
    }

    // Show modal
    async function showModal(filename) {
        const result = allResults[filename];
        if (!result) return;

        modalVideo.src = `/TempFrames/${filename}`;
        modalInfo.innerHTML = `
            <div class="p-4">
                <h3 class="font-medium mb-2">Frame Details</h3>
                <div class="space-y-1 text-sm">
                    <p>Filename: ${filename}</p>
                    <p>Class: ${result.class}</p>
                    <p>Confidence: ${(result.confidence * 100).toFixed(1)}%</p>
                </div>
            </div>
        `;
        
        modal.style.display = "flex";
    }

    // Close modal
    closeModal.addEventListener("click", () => {
        modal.style.display = "none";
        modalVideo.src = "";
    });

    // Close modal when clicking outside
    modal.addEventListener("click", (e) => {
        if (e.target === modal) {
            modal.style.display = "none";
            modalVideo.src = "";
        }
    });
});