import { Injectable } from '@angular/core';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class GeminiService {

  private generativeAI: GoogleGenerativeAI;
  private messageHistory: BehaviorSubject<any[]> = new BehaviorSubject<any[]>([]);
  private contextWindow: number = 100; // Now considers the last 100 messages

  // Private cache object
  private static correctionCache: { [input: string]: string } = {};

  // Rate limit tracking
  private lastRequestTime: number = Date.now();
  private requestCount: number = 0;
  private readonly REQUEST_LIMIT: number = 15;
  private readonly TIME_FRAME: number = 60000; // 1 minute in milliseconds

  constructor() {
    this.generativeAI = new GoogleGenerativeAI('AIzaSyB8G3m3XGwxTe5Cda6hlkYteasB8Ztmqjk');
    this.loadCache(); // Load cache from localStorage
    window.addEventListener('storage', this.onStorageChange.bind(this)); // Listen for storage changes
  }

  // Handle local storage changes
  private onStorageChange(event: StorageEvent): void {
    if (event.key === 'correctionCache') {
      GeminiService.correctionCache = event.newValue ? JSON.parse(event.newValue) : {};
      console.log('Cache updated from another window/tab:', GeminiService.correctionCache);
    }
  }

  async suggestCorrection(input: string): Promise<string> {
    // First check the cache
    const cachedCorrection = this.getCorrectionCache(input);
    if (cachedCorrection) {
      console.log(`Cache hit for input: "${input}"`);
      return cachedCorrection;
    }

    console.log(`Cache miss for input: "${input}". Making API call...`);
    // Handle rate limiting
    await this.handleRateLimit();

    try {
      const model = this.generativeAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const prompt = `Suggest a corrected version for this text: "${input}"`;
      const result = await model.generateContent(prompt);
      const response = await result.response;
      let correctedText = response.text();

      // Clean up the response
      correctedText = correctedText.replace(/\*\*/g, '').trim();

      // Store the corrected text in the cache
      this.setCorrectionCache(input, correctedText);

      // Store in localStorage as well for persistence across browser sessions
      this.saveCache();

      // Update rate limit tracking
      this.updateRateLimit();

      return correctedText;
    } catch (error) {
      console.error('Error getting spelling correction from Gemini:', error);
      return input; // Fallback to the original input if there's an error
    }
  }

  // Public method to get the correction cache
  public getCorrectionCache(input: string): string | undefined {
    return GeminiService.correctionCache[input];
  }

  // Public method to set the correction cache
  public setCorrectionCache(input: string, correctedInput: string): void {
    GeminiService.correctionCache[input] = correctedInput;
    console.log(`Cache updated: "${input}" -> "${correctedInput}"`);
  }

  private async handleRateLimit(): Promise<void> {
    const currentTime = Date.now();
    const timeElapsed = currentTime - this.lastRequestTime;

    if (timeElapsed < this.TIME_FRAME && this.requestCount >= this.REQUEST_LIMIT) {
      // Rate limit exceeded, wait for the next time frame or a maximum wait time
      const waitTime = Math.min(this.TIME_FRAME - timeElapsed, 1000); // Maximum wait time of 1 second
      console.log(`Rate limit exceeded. Waiting for ${waitTime}ms.`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    // Update last request time and count
    this.lastRequestTime = Date.now();
    this.requestCount = (timeElapsed >= this.TIME_FRAME) ? 1 : this.requestCount + 1;
  }

  // Update rate limit tracking
  private updateRateLimit(): void {
    const currentTime = Date.now();
    const timeElapsed = currentTime - this.lastRequestTime;

    if (timeElapsed >= this.TIME_FRAME) {
      // Reset rate limit tracking for new time frame
      this.lastRequestTime = currentTime;
      this.requestCount = 1;
    }
  }

  // Load cache from local storage
  private loadCache(): void {
    const storedCache = localStorage.getItem('correctionCache');
    if (storedCache) {
      GeminiService.correctionCache = JSON.parse(storedCache);
      console.log('Cache loaded:', GeminiService.correctionCache);
    } else {
      console.log('No cache found, starting with an empty cache.');
    }
  }

  // Save cache to local storage
  private saveCache(): void {
    localStorage.setItem('correctionCache', JSON.stringify(GeminiService.correctionCache));
    console.log('Cache saved to localStorage');
  }

  public getMessageHistory() {
    return this.messageHistory.asObservable();
  }
}
