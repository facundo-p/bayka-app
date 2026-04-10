/**
 * Regression test: ensures PlantacionesScreen passes onDelete to PlantationCard.
 *
 * This was lost during Phase 9 refactor (commit f2b06cd) when handleDeletePlantation
 * was extracted to usePlantaciones but never wired back to the screen.
 */
import * as fs from 'fs';
import * as path from 'path';

const SCREEN_PATH = path.resolve(__dirname, '../../src/screens/PlantacionesScreen.tsx');
const HOOK_PATH = path.resolve(__dirname, '../../src/hooks/usePlantaciones.ts');

describe('PlantacionesScreen - delete local regression', () => {
  const screenSource = fs.readFileSync(SCREEN_PATH, 'utf-8');
  const hookSource = fs.readFileSync(HOOK_PATH, 'utf-8');

  it('passes onDelete prop to PlantationCard', () => {
    expect(screenSource).toContain('onDelete=');
  });

  it('calls handleDeletePlantation from usePlantaciones', () => {
    expect(screenSource).toContain('handleDeletePlantation');
  });

  it('usePlantaciones hook exports handleDeletePlantation', () => {
    expect(hookSource).toContain('handleDeletePlantation');
    // Verify it's in the return object
    expect(hookSource).toMatch(/return\s*\{[\s\S]*handleDeletePlantation[\s\S]*\}/);
  });

  it('usePlantaciones hook imports deletePlantationLocally', () => {
    expect(hookSource).toContain('deletePlantationLocally');
  });

  it('renders ConfirmModal for delete dialogs', () => {
    expect(screenSource).toContain('ConfirmModal');
    expect(screenSource).toContain('confirmProps');
  });
});
