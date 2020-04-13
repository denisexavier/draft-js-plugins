import UserAgent from 'fbjs/lib/UserAgent';
import UnicodeUtils from 'fbjs/lib/UnicodeUtils';

const KEYS = {
  RETURN: 13,
  LEFT: 37,
  UP: 38,
  RIGHT: 39,
  DOWN: 40,
  SPACE: 32,
  ESC: 27,
  BACKSPACE: 8,
  TAB: 9,
  AT: 50,
  DELETE: 46,
  FAKE_CODE: 229,
};

const isMac = UserAgent.isPlatform('Mac OS X');

const WORD_KEYS = {
  A: 65,
  B: 66,
  C: 67,
  D: 68,
  E: 69,
  F: 70,
  V: 86,
  X: 88,
};

export const MOVEMENT = {
  LEFT: 'LEFT',
  RIGHT: 'RIGHT',
  START: 'START',
  END: 'END',
};

/**
 * Mac 除了正常的左右键之外
 * control + b / f 也提供左右移动的功能
 * 但遇到 mention 等 contenteditable false 的元素会失效
 */
export function getHorizontalMovement(evt) {
  const { type, keyCode, metaKey, ctrlKey, shiftKey } = evt;

  if (type !== 'keydown' || shiftKey || metaKey) return;

  if (!ctrlKey && keyCode === KEYS.LEFT ||
    isMac && ctrlKey && keyCode === WORD_KEYS.B
  ) {
    return MOVEMENT.LEFT;
  }

  if (!ctrlKey && keyCode === KEYS.RIGHT ||
    isMac && ctrlKey && keyCode === WORD_KEYS.F
  ) {
    return MOVEMENT.RIGHT;
  }
}

/**
 * Mac 中
 * control + a / e 可以移动至开头 / 结尾位置
 * 但遇到 mention 等 contenteditable false 的元素会失效
 */
export function getEdgeMovement(evt) {
  const { type, keyCode, metaKey, ctrlKey, shiftKey } = evt;

  if (type !== 'keydown' || shiftKey || metaKey || !isMac) return;

  if (ctrlKey && keyCode === WORD_KEYS.A) {
    return MOVEMENT.START;
  }

  if (ctrlKey && keyCode === WORD_KEYS.E) {
    return MOVEMENT.END;
  }
}

const zeroWidthReg = /^\u200B$/;

function getChar(text, offset) {
  return UnicodeUtils.substr(text, offset, 1);
}

export function isZeroWidthChar(text, offset) {
  return zeroWidthReg.test(getChar(text, offset));
}

export function getMentionLength(content, block, offset) {
  let len = 0;
  const entityKey = block.getEntityAt(offset);

  block.findEntityRanges(character => {
    return (
      character.getEntity() === entityKey &&
      content.getEntity(entityKey).getType() === 'mention'
    );
  }, (start, end) => {
    len = end - start;
  });

  return len;
}
