export interface IDag3dEngine {
  InitializeAsync(): Promise<void>;
  Update(): void;
}
