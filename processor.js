export class ImageProcessor {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.image = null;
        // Store original image data for reset or non-destructive edits if needed
        // For this simple version, we modify the canvas state directly usually
    }

    loadImage(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                this.image = new Image();
                this.image.onload = () => {
                    this.canvas.width = this.image.width;
                    this.canvas.height = this.image.height;
                    this.ctx.drawImage(this.image, 0, 0);
                    resolve({ width: this.image.width, height: this.image.height });
                };
                this.image.onerror = reject;
                this.image.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });
    }

    // Capture current canvas state as an Image object for chaining operations
    async _snapshot() {
        if (!this.canvas.width) return null;
        const src = this.canvas.toDataURL();
        const img = new Image();
        return new Promise(resolve => {
            img.onload = () => resolve(img);
            img.src = src;
        });
    }

    async rotate(degrees) {
        if (!this.image) throw new Error("No image data present.");
        const img = await this._snapshot();
        
        // Convert to radians
        const rads = (degrees * Math.PI) / 180;
        
        // Calculate new dimensions
        const sin = Math.abs(Math.sin(rads));
        const cos = Math.abs(Math.cos(rads));
        const newWidth = img.width * cos + img.height * sin;
        const newHeight = img.width * sin + img.height * cos;

        this.canvas.width = newWidth;
        this.canvas.height = newHeight;

        // Translate and rotate
        this.ctx.translate(newWidth / 2, newHeight / 2);
        this.ctx.rotate(rads);
        this.ctx.drawImage(img, -img.width / 2, -img.height / 2);
        this.image = await this._snapshot(); // Update internal reference
    }

    async applyFilter(filterString) {
        if (!this.image) throw new Error("No image data present.");
        const img = await this._snapshot();
        this.ctx.filter = filterString;
        this.ctx.drawImage(img, 0, 0);
        this.ctx.filter = 'none'; // Reset
        this.image = await this._snapshot();
    }

    async brightness(value) {
        // value is percentage, e.g., 100 is default. 115 is brighter.
        // We'll treat input as offset. +15 = 115%.
        const percentage = 100 + value;
        await this.applyFilter(`brightness(${percentage}%)`);
    }
    
    async contrast(value) {
        const percentage = 100 + value;
        await this.applyFilter(`contrast(${percentage}%)`);
    }

    async blur(radius) {
        await this.applyFilter(`blur(${radius}px)`);
    }

    async grayscale() {
        await this.applyFilter(`grayscale(100%)`);
    }
    
    async invert() {
        await this.applyFilter(`invert(100%)`);
    }
    
    async sepia() {
        await this.applyFilter(`sepia(100%)`);
    }

    async crop(x, y, w, h) {
        if (!this.image) throw new Error("No image data present.");
        
        // Clamp values
        x = Math.max(0, x);
        y = Math.max(0, y);
        w = Math.min(w, this.canvas.width - x);
        h = Math.min(h, this.canvas.height - y);

        if (w <= 0 || h <= 0) throw new Error("Invalid crop dimensions resulted in zero area.");

        const img = await this._snapshot();
        
        this.canvas.width = w;
        this.canvas.height = h;
        
        this.ctx.drawImage(img, x, y, w, h, 0, 0, w, h);
        this.image = await this._snapshot();
    }
    
    download() {
        if (!this.image) throw new Error("No image data to serialize.");
        const link = document.createElement('a');
        link.download = 'manipulated_pixel_data.png';
        link.href = this.canvas.toDataURL('image/png');
        link.click();
    }

    getDimensions() {
        return { width: this.canvas.width, height: this.canvas.height };
    }
}