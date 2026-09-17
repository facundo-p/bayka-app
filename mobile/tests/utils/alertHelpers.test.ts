import { showDoubleConfirmDialog } from '../../src/utils/alertHelpers';
import { colors } from '../../src/theme';

describe('showDoubleConfirmDialog', () => {
  test('los dos pasos usan el color de peligro del tema', () => {
    const show = jest.fn();
    const onConfirm = jest.fn();
    showDoubleConfirmDialog(show, 'Eliminar', 'Mensaje', 'Eliminar', 'Final', onConfirm);

    const primero = show.mock.calls[0][0];
    expect(primero.iconColor).toBe(colors.danger);

    primero.buttons[1].onPress();
    const segundo = show.mock.calls[1][0];
    expect(segundo.iconColor).toBe(colors.danger);

    segundo.buttons[1].onPress();
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
