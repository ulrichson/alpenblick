/**
 * Describes Angular environment
 */
export interface Environment {
  production: boolean;

  /**
   * Optional Matomo Analyitcs config
   */
  matomo?: {
    /**
     * Matomo root url **with trailing slash**
     */
    url: string;

    /**
     * Matomo site id to track
     */
    id: number;
  };
}
