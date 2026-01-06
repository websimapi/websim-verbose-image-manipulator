import { ImageProcessor } from './processor.js';

const canvas = document.getElementById('mainCanvas');
const processor = new ImageProcessor(canvas);
const logOutput = document.getElementById('logOutput');
const commandInput = document.getElementById('commandInput');
const submitBtn = document.getElementById('submitBtn');
const fileInput = document.getElementById('fileInput');
const placeholder = document.getElementById('placeholderText');

let isProcessing = false;
let conversationHistory = [];

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
        
        // Prepare history for LLM context
        const systemMessage = {
            role: "system",
            content: `You are the bureaucratic logic core of the 'Verbose Image Manipulator'. 
            
            PROTOCOL:
            1. EXECUTE A MATCHING OPERATION FOR EVERY REQUEST. Do not ask for clarification. Do not deny based on ambiguity.
            2. INFER MISSING PARAMETERS based on context or common sense.
               - "Rotate": assume 90 degrees clockwise if unspecified.
               - "Crop": assume a center crop (remove 20% edges) or simple trim if unspecified. YOU MUST CALCULATE X, Y, WIDTH, HEIGHT integers based on the provided Current Dimensions.
               - "Brighten": assume +20%.
               - "Darken": assume -20%.
            3. IF NO IMAGE IS LOADED:
               - If request implies editing, return operation 'upload' and politely explain a file is needed first in the message.
               - If request is to load/open/start, return operation 'upload'.
            4. CREATIVE MAPPING: If the request is abstract (e.g., "make it cool", "fix it", "chaos"), pick the closest visual metaphor (e.g., 'sepia', 'contrast', 'blur').
            5. BUREAUCRATIC PERSONA: Maintain the verbose, bureaucratic tone in the 'message', claiming you have "auto-completed the required forms", "inferred missing data fields", or "invoked emergency override protocols" to handle their vague request.
            6. NSFW/Explicit content is STRICTLY FORBIDDEN. Return success: false only for this reason.

            CURRENT CONTEXT:
            - Image Loaded: ${hasImage}
            - Current Dimensions: Width ${currentDims.width}, Height ${currentDims.height}
            
            AVAILABLE OPERATIONS:
            - 'upload': Triggers file dialog.
            - 'rotate': Params { degrees: number }. (Default: 90)
            - 'brightness': Params { value: number } (Percentage offset, e.g., 20 for +20%, -20 for darker).
            - 'contrast': Params { value: number } (Percentage offset).
            - 'blur': Params { radius: number }. (Typical range: 1-20).
            - 'grayscale': No params.
            - 'invert': No params.
            - 'sepia': No params.
            - 'crop': Params { x: number, y: number, width: number, height: number }. 
              (IMPORTANT: You MUST calculate specific integers based on Width:${currentDims.width} and Height:${currentDims.height} context. Do not return nulls.)
            - 'download': Triggers download.

            RESPONSE FORMAT (JSON ONLY):
            {
                "success": boolean,
                "message": "The textual response to show the user (very formal/bureaucratic).",
                "operation": "string (one of the above or null)",
                "params": {}
            }
            `
        };

        // Manage history
        const userMessage = { role: "user", content: command };
        let messages = [systemMessage, ...conversationHistory, userMessage];

        // Call LLM
        const completion = await websim.chat.completions.create({
            messages: messages,
            json: true
        });

        const result = JSON.parse(completion.content);

        // Update history (keep last 6 turns to avoid context limit issues)
        conversationHistory.push(userMessage);
        conversationHistory.push({ role: "assistant", content: completion.content });
        if (conversationHistory.length > 10) conversationHistory = conversationHistory.slice(-10);

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