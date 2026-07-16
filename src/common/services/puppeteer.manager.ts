import puppeteer, { Browser, Page } from "puppeteer";

export class PuppeteerManager {
  private static instance: PuppeteerManager;
  private browser: Browser | null = null;

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

    this.browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
      ],
    });

    return this.browser;
  }

  public async createPage(): Promise<Page> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    return page;
  }

  public async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}
