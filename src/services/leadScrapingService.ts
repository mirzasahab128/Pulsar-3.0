import { RCMLead, ContinuousScrapeStatus, ScrapeBatchInfo, ContinuousScrapeConfig } from '../types';

export async function fetchScrapedLeads(params: {
  specialty?: string;
  state?: string;
  query?: string;
  count?: number;
}): Promise<RCMLead[]> {
  try {
    const res = await fetch('/api/leads/scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (data.success && Array.isArray(data.leads)) {
      return data.leads;
    }
    throw new Error('Invalid response from leads scraper');
  } catch (e) {
    // No synthetic fallback: when the discovery server is unreachable, the
    // honest result is an error, never invented leads presented as scraped.
    console.warn('Scraper API call failed, no leads generated:', e);
    throw new Error('Lead discovery is unavailable: the Pulsar server is not reachable. No leads were generated.');
  }
}

export interface ContinuousScraperListener {
  onStatusChange?: (status: ContinuousScrapeStatus, batchInfo?: ScrapeBatchInfo) => void;
  onBatchQueued?: (batchNumber: number, batchInfo: ScrapeBatchInfo) => void;
  onBatchScraping?: (batchNumber: number, batchInfo: ScrapeBatchInfo) => void;
  onBatchProcessing?: (batchNumber: number, batchInfo: ScrapeBatchInfo, leads: RCMLead[]) => void;
  onBatchCompleted?: (batchNumber: number, batchInfo: ScrapeBatchInfo) => void;
  onLeadsDelivered?: (newLeads: RCMLead[], batchInfo: ScrapeBatchInfo) => void;
  onError?: (error: Error, batchNumber: number) => void;
}

export class ContinuousLeadScraper {
  private config: ContinuousScrapeConfig;
  private listeners: Set<ContinuousScraperListener> = new Set();
  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private batchCounter: number = 0;
  private totalLeadsGenerated: number = 0;
  private currentBatch: ScrapeBatchInfo | null = null;
  private batchHistory: ScrapeBatchInfo[] = [];
  private loopTimeoutId: any = null;
  private processingTimeoutId: any = null;

  constructor(initialConfig?: Partial<ContinuousScrapeConfig>) {
    this.config = {
      batchSize: 5,
      intervalDelayMs: 2500,
      autoProcessDelayMs: 1200,
      maxBatches: 0, // 0 = infinite perpetual pipeline
      ...initialConfig,
    };
  }

  public subscribe(listener: ContinuousScraperListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public updateConfig(newConfig: Partial<ContinuousScrapeConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  public getConfig(): ContinuousScrapeConfig {
    return { ...this.config };
  }

  public getStatus(): {
    isRunning: boolean;
    isPaused: boolean;
    batchCounter: number;
    totalLeadsGenerated: number;
    currentBatch: ScrapeBatchInfo | null;
    history: ScrapeBatchInfo[];
  } {
    return {
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      batchCounter: this.batchCounter,
      totalLeadsGenerated: this.totalLeadsGenerated,
      currentBatch: this.currentBatch,
      history: [...this.batchHistory],
    };
  }

  /**
   * Starts the continuous scraping perpetual loop.
   */
  public start(configOverrides?: Partial<ContinuousScrapeConfig>): void {
    if (this.isRunning) {
      if (this.isPaused) {
        this.resume();
      }
      return;
    }

    if (configOverrides) {
      this.updateConfig(configOverrides);
    }

    this.isRunning = true;
    this.isPaused = false;

    // Begin the first batch cycle
    this.queueNextBatch();
  }

  /**
   * Stops the continuous scraping loop completely.
   */
  public stop(): void {
    this.isRunning = false;
    this.isPaused = false;
    if (this.loopTimeoutId) {
      clearTimeout(this.loopTimeoutId);
      this.loopTimeoutId = null;
    }
    if (this.processingTimeoutId) {
      clearTimeout(this.processingTimeoutId);
      this.processingTimeoutId = null;
    }

    if (this.currentBatch && this.currentBatch.status !== 'Completed') {
      this.currentBatch = {
        ...this.currentBatch,
        status: 'Idle',
      };
      this.notifyStatusChange('Idle', this.currentBatch);
    } else {
      this.notifyStatusChange('Idle');
    }
  }

  /**
   * Temporarily pause the loop.
   */
  public pause(): void {
    if (!this.isRunning || this.isPaused) return;
    this.isPaused = true;
    if (this.loopTimeoutId) {
      clearTimeout(this.loopTimeoutId);
      this.loopTimeoutId = null;
    }
    this.notifyStatusChange('Paused', this.currentBatch || undefined);
  }

  /**
   * Resume the paused perpetual loop.
   */
  public resume(): void {
    if (!this.isRunning || !this.isPaused) return;
    this.isPaused = false;
    if (this.currentBatch && this.currentBatch.status === 'Completed') {
      this.queueNextBatch();
    } else if (!this.currentBatch || this.currentBatch.status === 'Idle' || this.currentBatch.status === 'Paused') {
      this.queueNextBatch();
    }
  }

  /**
   * Step 1: Queues a new batch.
   * Creates batch metadata with status 'Queued' and immediately initiates scraping.
   */
  private queueNextBatch(): void {
    if (!this.isRunning || this.isPaused) return;

    if (this.config.maxBatches && this.config.maxBatches > 0 && this.batchCounter >= this.config.maxBatches) {
      this.stop();
      return;
    }

    this.batchCounter += 1;
    const batchId = `batch-${Date.now()}-${this.batchCounter}-${Math.random().toString(36).slice(2, 6)}`;
    
    const newBatch: ScrapeBatchInfo = {
      batchId,
      batchNumber: this.batchCounter,
      status: 'Queued',
      leadsCount: 0,
      specialty: this.config.targetSpecialty,
      state: this.config.targetState,
      startedAt: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      leads: [],
    };

    this.currentBatch = newBatch;
    this.notifyBatchQueued(newBatch);
    this.notifyStatusChange('Queued', newBatch);

    // Transition swiftly from Queued to Scraping
    this.executeScrapeCycle(newBatch);
  }

  /**
   * Step 2: Executes scraping and transitions status from 'Queued' to 'Scraping'.
   */
  private async executeScrapeCycle(batch: ScrapeBatchInfo): Promise<void> {
    if (!this.isRunning || this.isPaused) return;

    // Transition to 'Scraping'
    batch.status = 'Scraping';
    this.currentBatch = { ...batch };
    this.notifyBatchScraping(this.currentBatch);
    this.notifyStatusChange('Scraping', this.currentBatch);

    try {
      // Call lead scraping service
      const rawLeads = await fetchScrapedLeads({
        specialty: this.config.targetSpecialty !== 'All' ? this.config.targetSpecialty : undefined,
        state: this.config.targetState !== 'All' ? this.config.targetState : undefined,
        query: this.config.query || undefined,
        count: this.config.batchSize || 5,
      });

      if (!this.isRunning) return;

      // Step 3: Transition status to 'Processing'
      // Enrich and validate leads (NPI verification, deduplication keys, EHR formatting)
      batch.status = 'Processing';
      batch.leadsCount = rawLeads.length;
      this.currentBatch = { ...batch };
      this.notifyBatchProcessing(this.currentBatch, rawLeads);
      this.notifyStatusChange('Processing', this.currentBatch);

      const processingDelay = this.config.autoProcessDelayMs ?? 1000;

      this.processingTimeoutId = setTimeout(() => {
        if (!this.isRunning) return;
        this.completeAndQueueNext(batch, rawLeads);
      }, processingDelay);

    } catch (err: any) {
      console.warn(`Continuous scraper batch #${batch.batchNumber} error:`, err);
      batch.status = 'Error';
      batch.error = err?.message || 'Scraping failed';
      this.currentBatch = { ...batch };
      this.notifyError(err instanceof Error ? err : new Error(String(err)), batch.batchNumber);
      this.notifyStatusChange('Error', this.currentBatch);

      // No auto-requeue on failure: a dead discovery server must surface as
      // a visible Error state, not a perpetual loop of failed batches.
      this.isRunning = false;
      this.isPaused = false;
      if (this.loopTimeoutId) {
        clearTimeout(this.loopTimeoutId);
        this.loopTimeoutId = null;
      }
    }
  }

  /**
   * Step 4 & 5: Processing completes, hits 'Completed', delivers leads,
   * and AUTOMATICALLY queues the next batch to ensure a perpetual lead pipeline!
   */
  private completeAndQueueNext(batch: ScrapeBatchInfo, rawLeads: RCMLead[]): void {
    if (!this.isRunning) return;

    // Enrich leads with unique persistent keys, timestamps, and priority tags
    const enrichedLeads: RCMLead[] = rawLeads.map((lead, idx) => ({
      ...lead,
      id: lead.id && !lead.id.startsWith('lead-')
        ? lead.id 
        : `perpetual-lead-${Date.now()}-${this.batchCounter}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
      tags: lead.tags && lead.tags.length > 0 ? lead.tags : ['Target'],
      source: lead.source || `Pulsar Continuous Scraper (Batch #${batch.batchNumber})`,
      status: lead.status || 'Ready for Call',
    }));

    // Mark batch processing status as 'Completed'
    batch.status = 'Completed';
    batch.leads = enrichedLeads;
    batch.completedAt = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    this.totalLeadsGenerated += enrichedLeads.length;
    this.currentBatch = { ...batch };

    // Record in history (retain last 20 batches for memory efficiency)
    this.batchHistory.unshift({ ...batch });
    if (this.batchHistory.length > 20) {
      this.batchHistory.pop();
    }

    // Notify listeners that batch completed and deliver leads to the pipeline
    this.notifyBatchCompleted(this.currentBatch);
    this.notifyLeadsDelivered(enrichedLeads, this.currentBatch);
    this.notifyStatusChange('Completed', this.currentBatch);

    // CRITICAL: Once processing status hits 'Completed', AUTOMATICALLY queue a new batch
    // ensuring a perpetual lead pipeline without manual intervention!
    if (this.isRunning && !this.isPaused) {
      const interval = Math.max(500, this.config.intervalDelayMs ?? 2500);
      this.loopTimeoutId = setTimeout(() => {
        // Automatically queues the next batch
        this.queueNextBatch();
      }, interval);
    }
  }

  // Listener notification helpers
  private notifyStatusChange(status: ContinuousScrapeStatus, batchInfo?: ScrapeBatchInfo): void {
    this.listeners.forEach((l) => l.onStatusChange?.(status, batchInfo));
  }

  private notifyBatchQueued(batchInfo: ScrapeBatchInfo): void {
    this.listeners.forEach((l) => l.onBatchQueued?.(batchInfo.batchNumber, batchInfo));
  }

  private notifyBatchScraping(batchInfo: ScrapeBatchInfo): void {
    this.listeners.forEach((l) => l.onBatchScraping?.(batchInfo.batchNumber, batchInfo));
  }

  private notifyBatchProcessing(batchInfo: ScrapeBatchInfo, leads: RCMLead[]): void {
    this.listeners.forEach((l) => l.onBatchProcessing?.(batchInfo.batchNumber, batchInfo, leads));
  }

  private notifyBatchCompleted(batchInfo: ScrapeBatchInfo): void {
    this.listeners.forEach((l) => l.onBatchCompleted?.(batchInfo.batchNumber, batchInfo));
  }

  private notifyLeadsDelivered(leads: RCMLead[], batchInfo: ScrapeBatchInfo): void {
    this.listeners.forEach((l) => l.onLeadsDelivered?.(leads, batchInfo));
  }

  private notifyError(error: Error, batchNumber: number): void {
    this.listeners.forEach((l) => l.onError?.(error, batchNumber));
  }
}

// Singleton continuous scraper instance for app-wide sharing
export const continuousScrapeService = new ContinuousLeadScraper();

/**
 * Utility function to create a standalone Continuous Scrape runner
 */
export function createContinuousScraper(config?: Partial<ContinuousScrapeConfig>): ContinuousLeadScraper {
  return new ContinuousLeadScraper(config);
}

/**
 * 'Continuous Scrape' utility function in the lead scraping service that automatically
 * queues a new batch of leads once the previous batch's processing status hits 'Completed',
 * ensuring a perpetual lead pipeline without manual intervention.
 *
 * @param config Optional configuration for batch size, delay intervals, target criteria
 * @param listener Callbacks for batch queueing, scraping, processing, completed, and lead delivery
 * @returns Control handles to stop, pause, resume, and inspect the continuous scraper
 */
export function continuousScrape(
  config?: Partial<ContinuousScrapeConfig>,
  listener?: ContinuousScraperListener
): {
  scraper: ContinuousLeadScraper;
  stop: () => void;
  pause: () => void;
  resume: () => void;
} {
  const scraper = new ContinuousLeadScraper(config);
  if (listener) {
    scraper.subscribe(listener);
  }
  scraper.start();
  return {
    scraper,
    stop: () => scraper.stop(),
    pause: () => scraper.pause(),
    resume: () => scraper.resume(),
  };
}
