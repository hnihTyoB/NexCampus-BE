import puppeteer, { Browser, Page } from "puppeteer";

export class PuppeteerManager {
  private static instance: PuppeteerManager;
  private browser: Browser | null = null;
  private isLaunching = false;

  private constructor() {}

  public static getInstance(): PuppeteerManager {
    if (!PuppeteerManager.instance) {
      PuppeteerManager.instance = new PuppeteerManager();
    }
    return PuppeteerManager.instance;
  }

  public async getBrowser(): Promise<Browser> {
    if (this.browser && this.browser.connected) {
      return this.browser;
    }

    if (this.isLaunching) {
      // Chờ nếu đang khởi chạy
      await new Promise((resolve) => setTimeout(resolve, 500));
      if (this.browser && this.browser.connected) {
        return this.browser;
      }
    }

    this.isLaunching = true;
    try {
      this.browser = await puppeteer.launch({
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
          "--no-first-run",
          "--no-zygote",
          "--single-process",
        ],
      });
      return this.browser;
    } finally {
      this.isLaunching = false;
    }
  }

  public async createPage(): Promise<Page> {
    const browser = await this.getBrowser();
    return browser.newPage();
  }

  public async closeBrowser(): Promise<void> {
    if (this.browser) {
      try {
        await this.browser.close();
      } catch (err: any) {
        console.warn("[PuppeteerManager] Error closing browser:", err.message);
      } finally {
        this.browser = null;
      }
    }
  }
}

export const puppeteerManager = PuppeteerManager.getInstance();
