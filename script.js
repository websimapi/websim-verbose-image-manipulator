import { ImageProcessor } from './processor.js';

const canvas = document.getElementById('mainCanvas');
const processor = new ImageProcessor(canvas);
const logOutput = document.getElementById('logOutput');
const commandInput = document.getElementById('commandInput');
const submitBtn = document.getElementById('submitBtn');
const fileInput = document.getElementById('fileInput');
const placeholder = document.getElementById('placeholderText');

let isProcessing = false;

function log(text, type = 'system') {
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.textContent = text;
    logOutput.appendChild(entry);
    logOutput.scrollTop = logOutput.scrollHeight;
}

// Handle file input changes
fileInput.addEventListener('change', async (e) => {
    if (e.target.files && e.target.files[0]) {
        try {
            log("Attempting to decode file stream...", 'system');
            const dims = await processor.loadImage(e.target.files[0]);
            placeholder.style.display = 'none';
            log(`File successfully ingested. Dimensions: ${dims.width}px by ${dims.height}px.`, 'system');
        } catch (err) {
            log(`CRITICAL ERROR during file ingestion: ${err.message}`, 'error');
        }
    }
});

// Handle Command Submission
submitBtn.addEventListener('click', processCommand);
commandInput.addEventListener('keydown', (e) => {
    // Submit on Ctrl+Enter
    if (e.key === 'Enter' && e.ctrlKey) {
        processCommand();
    }
});

async function processCommand() {
    if (isProcessing) return;
    const command = commandInput.value.trim();
    if (!command) return;

    // Clear input
    commandInput.value = '';
    log(command, 'user');

    isProcessing = true;
    submitBtn.textContent = "PROCESSING...";
    submitBtn.disabled = true;

    try {
        // Construct context for the LLM
        const currentDims = processor.getDimensions();
        const hasImage = !!processor.image;
        
        // Call LLM
        const completion = await websim.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: `You are the bureaucratic logic core of the 'Verbose Image Manipulator'. 
                    
                    PROTOCOL:
                    1. Users MUST provide elaborate, grammatically complete, extremely verbose English commands.
                    2. If a command is concise (under ~10 words) or informal, REJECT it immediately with a scolding message about proper protocol.
                    3. If the command is valid, interpret the intent into a JSON instruction.
                    
                    CURRENT CONTEXT:
                    - Image Loaded: ${hasImage}
                    - Dimensions: Width ${currentDims.width}, Height ${currentDims.height}
                    
                    AVAILABLE OPERATIONS:
                    - 'upload': Triggers file dialog. (Keywords: ingest, load, open file, read from disk)
                    - 'rotate': Params { degrees: number }.
                    - 'brightness': Params { value: number } (Percentage offset, e.g., 20 for +20%).
                    - 'contrast': Params { value: number } (Percentage offset).
                    - 'blur': Params { radius: number }.
                    - 'grayscale': No params.
                    - 'invert': No params.
                    - 'sepia': No params.
                    - 'crop': Params { x: number, y: number, width: number, height: number }. 
                      (If user uses relative terms like "remove top half", calculate the pixels based on current dimensions: W:${currentDims.width}, H:${currentDims.height}).
                    - 'download': Triggers download. (Keywords: serialize, save, export, write to disk).

                    RESPONSE FORMAT (JSON ONLY):
                    {
                        "success": boolean,
                        "message": "The textual response to show the user (very formal/bureaucratic).",
                        "operation": "string (one of the above or null)",
                        "params": {}
                    }
                    
                    Examples:
                    User: "Rotate 90"
                    Response: { "success": false, "message": "Request denied. The input provided lacks the requisite verbosity and formal structure required by this facility.", "operation": null, "params": {} }
                    
                    User: "I humbly request that the system rotates the currently active pixel matrix by precisely ninety degrees in a clockwise fashion."
                    Response: { "success": true, "message": "Request acknowledged. Initiating rotation algorithms on the active buffer.", "operation": "rotate", "params": { "degrees": 90 } }
                    `
                },
                {
                    role: "user",
                    content: command
                }
            ],
            json: true
        });

        const result = JSON.parse(completion.content);

        // Display system response
        if (result.message) {
            log(result.message, result.success ? 'system' : 'error');
        }

        if (result.success && result.operation) {
            await executeOperation(result.operation, result.params);
        }

    } catch (err) {
        log(`INTERNAL PROCESSING ERROR: ${err.message}`, 'error');
    } finally {
        isProcessing = false;
        submitBtn.textContent = "TRANSMIT REQUEST";
        submitBtn.disabled = false;
    }
}

async function executeOperation(op, params) {
    try {
        switch (op) {
            case 'upload':
                fileInput.click();
                break;
            case 'rotate':
                await processor.rotate(params.degrees || 90);
                log("Rotation complete.", 'system');
                break;
            case 'brightness':
                await processor.brightness(params.value || 0);
                log("Luminosity adjustment complete.", 'system');
                break;
            case 'contrast':
                await processor.contrast(params.value || 0);
                log("Contrast adjustment complete.", 'system');
                break;
            case 'blur':
                await processor.blur(params.radius || 0);
                log("Gaussian blur application complete.", 'system');
                break;
            case 'grayscale':
                await processor.grayscale();
                log("Desaturation complete.", 'system');
                break;
            case 'invert':
                await processor.invert();
                log("Color inversion complete.", 'system');
                break;
            case 'sepia':
                await processor.sepia();
                log("Sepia tone application complete.", 'system');
                break;
            case 'crop':
                if (params.x !== undefined && params.y !== undefined && params.width && params.height) {
                    await processor.crop(params.x, params.y, params.width, params.height);
                    log("Canvas truncation complete.", 'system');
                } else {
                    log("Error: Insufficient coordinate data for crop operation.", 'error');
                }
                break;
            case 'download':
                processor.download();
                log("Data serialization and export initiated.", 'system');
                break;
            default:
                log(`Unknown operation code: ${op}`, 'error');
        }
    } catch (e) {
        log(`EXECUTION ERROR: ${e.message}`, 'error');
    }
}