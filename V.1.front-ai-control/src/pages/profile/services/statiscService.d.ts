// Type declarations for Statistics Service

export interface StatisticsData {
  [key: string]: any;
}

export interface StatisticsService {
  getStatistics: () => Promise<StatisticsData>;
  updateStatistics: (data: StatisticsData) => Promise<void>;
}

declare const statisticsService: StatisticsService;
export default statisticsService;
