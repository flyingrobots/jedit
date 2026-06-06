import { colorHex, type TokenValue } from "@flyingrobots/bijou";
import type { Cmd, KeyMsg } from "@flyingrobots/bijou-tui";
import {
  NotificationPlacements,
  NotificationTones,
  NotificationVariants,
  pushNotificationToast,
} from "../../ui/feedback.js";
import {
  nextTitleAsciiPalette,
  TITLE_ASCII_PALETTE,
  TITLE_RENDER_MODE,
  type TitleAsciiPalette,
} from "../../ui/title-screen.js";
import { updateTitleCameraFromKey } from "../title-camera-session.js";
import {
  applyTitleMeshMaterial,
  nextTitleMeshMaterialIndex,
  titleMeshMaterialPresetAt,
} from "./title-mesh-materials.js";
import type { WorkspaceKeyBindingContext } from "./key-binding-context.js";
import type { WorkspaceModel } from "./model.js";
import type { WorkspaceMsg } from "./msg.js";
import { WorkspaceKeys } from "./workspace-key.js";

const TITLE_SHADER_TOAST_TITLE = "Title shader";
const TITLE_ASCII_PALETTE_TOAST_TITLE = "ASCII palette";
const TITLE_MESH_MATERIAL_TOAST_TITLE = "Title material";
const TITLE_SHADER_BRAILLE_LABEL = "Braille";
const TITLE_SHADER_ASCII_LABEL = "ASCII";
const TITLE_ASCII_PALETTE_DENSE_LABEL = "Dense";
const TITLE_ASCII_PALETTE_MINIMAL_LABEL = "Minimal";
const TITLE_ASCII_PALETTE_TECHNICAL_LABEL = "Technical";
const TITLE_ASCII_PALETTE_HATCHING_LABEL = "Hatching";
const TITLE_ASCII_PALETTE_MATRIX_LABEL = "Matrix";
const TITLE_ASCII_PALETTE_BLOCKS_LABEL = "Blocks";
const TITLE_ASCII_PALETTE_DITHER_LABEL = "Dither";
const FALLBACK_TOAST_FOREGROUND = "#e2e7ec";
const FALLBACK_TOAST_BACKGROUND = "#0e1116";
const FALLBACK_TOAST_ACCENT = "#d897ff";
const UNKNOWN_TITLE_ASCII_PALETTE_MESSAGE = "Unknown TitleAsciiPalette variant";

type KeyBindingResult = [WorkspaceModel, Cmd<WorkspaceMsg>[]];

class InvalidTitleAsciiPaletteError extends Error {
  public constructor(palette: string) {
    super(`${UNKNOWN_TITLE_ASCII_PALETTE_MESSAGE}: ${palette}`);
    this.name = "InvalidTitleAsciiPaletteError";
    Object.freeze(this);
  }
}

export function updateTitleScreenKey(
  msg: KeyMsg,
  model: WorkspaceModel,
  context: WorkspaceKeyBindingContext,
): KeyBindingResult | undefined {
  if (model.editor != null) {
    return undefined;
  }

  return (
    updateTitleRenderKey(msg, model, context) ??
    updateTitleMeshMaterialKey(msg, model, context) ??
    updateTitleEscapeKey(msg, model) ??
    updateTitleCameraKey(msg, model)
  );
}

function updateTitleRenderKey(
  msg: KeyMsg,
  model: WorkspaceModel,
  context: WorkspaceKeyBindingContext,
): KeyBindingResult | undefined {
  if (msg.key === WorkspaceKeys.One) {
    return pushTitleScreenToast(
      { ...model, titleRenderMode: TITLE_RENDER_MODE.Braille },
      TITLE_SHADER_BRAILLE_LABEL,
      context,
    );
  }
  if (msg.key === WorkspaceKeys.Two) {
    return pushTitleScreenToast(
      { ...model, titleRenderMode: TITLE_RENDER_MODE.Ascii },
      asciiShaderLabel(model),
      context,
    );
  }
  if (
    msg.key !== WorkspaceKeys.Period ||
    model.titleRenderMode !== TITLE_RENDER_MODE.Ascii
  ) {
    return msg.key === WorkspaceKeys.Period ? [model, []] : undefined;
  }

  const titleAsciiPalette = nextTitleAsciiPalette(model.titleAsciiPalette);
  return pushAsciiPaletteToast(
    { ...model, titleAsciiPalette },
    titleAsciiPalette,
    context,
  );
}

function updateTitleMeshMaterialKey(
  msg: KeyMsg,
  model: WorkspaceModel,
  context: WorkspaceKeyBindingContext,
): KeyBindingResult | undefined {
  if (!isTitleMeshMaterialKey(msg)) {
    return undefined;
  }
  const titleMeshMaterialIndex = nextTitleMeshMaterialIndex(
    model.titleMeshMaterialIndex,
  );
  const preset = titleMeshMaterialPresetAt(titleMeshMaterialIndex);
  const sceneOverride =
    model.sceneOverride == null
      ? undefined
      : applyTitleMeshMaterial(model.sceneOverride, preset);
  return pushTitleMeshMaterialToast(
    {
      ...model,
      titleMeshMaterialIndex,
      ...(sceneOverride == null ? {} : { sceneOverride }),
    },
    preset.name,
    context,
  );
}

function updateTitleEscapeKey(
  msg: KeyMsg,
  model: WorkspaceModel,
): KeyBindingResult | undefined {
  return msg.key === WorkspaceKeys.Escape
    ? [{ ...model, quitConfirmOpen: true }, []]
    : undefined;
}

function updateTitleCameraKey(
  msg: KeyMsg,
  model: WorkspaceModel,
): KeyBindingResult | undefined {
  const update = updateTitleCameraFromKey(msg.key, model.titleCamera);
  return update == null
    ? undefined
    : [{ ...model, titleCamera: update.state }, update.commands];
}

function pushTitleScreenToast(
  model: WorkspaceModel,
  message: string,
  context: WorkspaceKeyBindingContext,
): KeyBindingResult {
  return pushToast(model, TITLE_SHADER_TOAST_TITLE, message, context);
}

function pushTitleMeshMaterialToast(
  model: WorkspaceModel,
  message: string,
  context: WorkspaceKeyBindingContext,
): KeyBindingResult {
  return pushToast(model, TITLE_MESH_MATERIAL_TOAST_TITLE, message, context);
}

function pushAsciiPaletteToast(
  model: WorkspaceModel,
  palette: TitleAsciiPalette,
  context: WorkspaceKeyBindingContext,
): KeyBindingResult {
  return pushToast(
    model,
    TITLE_ASCII_PALETTE_TOAST_TITLE,
    titleAsciiPaletteLabel(palette),
    context,
  );
}

function pushToast(
  model: WorkspaceModel,
  title: string,
  message: string,
  context: WorkspaceKeyBindingContext,
): KeyBindingResult {
  return pushNotificationToast(
    model,
    {
      title,
      message,
      variant: NotificationVariants.Toast,
      tone: NotificationTones.Info,
      placement: NotificationPlacements.LowerRight,
      bgToken: titleToastBackgroundToken(model),
      accentToken: titleToastAccentToken(model),
    },
    context.nowMs(),
    context.createNotificationTickCmd,
  );
}

function asciiShaderLabel(model: WorkspaceModel): string {
  return `${TITLE_SHADER_ASCII_LABEL} · ${titleAsciiPaletteLabel(model.titleAsciiPalette)}`;
}

function isTitleMeshMaterialKey(msg: KeyMsg): boolean {
  return (
    !msg.ctrl &&
    !msg.alt &&
    (msg.key === WorkspaceKeys.M || msg.key === WorkspaceKeys.UpperM)
  );
}

function titleToastBackgroundToken(model: WorkspaceModel): TokenValue {
  return {
    hex:
      colorHex(model.jeditTheme.surface.workspace.fg) ??
      model.jeditTheme.surface.workspace.hex ??
      FALLBACK_TOAST_FOREGROUND,
    bg:
      colorHex(model.jeditTheme.surface.workspace.bg) ??
      FALLBACK_TOAST_BACKGROUND,
  };
}

function titleToastAccentToken(model: WorkspaceModel): TokenValue {
  return {
    hex:
      colorHex(model.jeditTheme.cursor.normal.bg) ??
      model.jeditTheme.cursor.normal.hex ??
      FALLBACK_TOAST_ACCENT,
    bg:
      colorHex(model.jeditTheme.surface.workspace.bg) ??
      FALLBACK_TOAST_BACKGROUND,
  };
}

function titleAsciiPaletteLabel(palette: TitleAsciiPalette): string {
  switch (palette) {
    case TITLE_ASCII_PALETTE.Dense:
      return TITLE_ASCII_PALETTE_DENSE_LABEL;
    case TITLE_ASCII_PALETTE.Minimal:
      return TITLE_ASCII_PALETTE_MINIMAL_LABEL;
    case TITLE_ASCII_PALETTE.Technical:
      return TITLE_ASCII_PALETTE_TECHNICAL_LABEL;
    case TITLE_ASCII_PALETTE.Hatching:
      return TITLE_ASCII_PALETTE_HATCHING_LABEL;
    case TITLE_ASCII_PALETTE.Matrix:
      return TITLE_ASCII_PALETTE_MATRIX_LABEL;
    case TITLE_ASCII_PALETTE.Blocks:
      return TITLE_ASCII_PALETTE_BLOCKS_LABEL;
    case TITLE_ASCII_PALETTE.Dither:
      return TITLE_ASCII_PALETTE_DITHER_LABEL;
    default: {
      const exhaustive: never = palette;
      throw new InvalidTitleAsciiPaletteError(String(exhaustive));
    }
  }
}
