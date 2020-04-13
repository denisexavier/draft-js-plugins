import decorateComponentWithProps from 'decorate-component-with-props';
import { EditorState, Modifier } from 'draft-js';
import { Map } from 'immutable';
import Mention from './Mention';
import MentionSuggestions from './MentionSuggestions'; // eslint-disable-line import/no-named-as-default
import MentionSuggestionsPortal from './MentionSuggestionsPortal';
import defaultRegExp from './defaultRegExp';
import mentionStrategy from './mentionStrategy';
import mentionSuggestionsStrategy from './mentionSuggestionsStrategy';
import mentionStyles from './mentionStyles.css';
import mentionSuggestionsStyles from './mentionSuggestionsStyles.css';
import mentionSuggestionsEntryStyles from './mentionSuggestionsEntryStyles.css';
import suggestionsFilter from './utils/defaultSuggestionsFilter';
import defaultPositionSuggestions from './utils/positionSuggestions';
import { MOVEMENT, getEdgeMovement, getHorizontalMovement, isZeroWidthChar, getMentionLength } from './utils/cursorHelper';

export { default as MentionSuggestions } from './MentionSuggestions';

export const defaultTheme = {
  // CSS class for mention text
  mention: mentionStyles.mention,
  // CSS class for suggestions component
  mentionSuggestions: mentionSuggestionsStyles.mentionSuggestions,
  // CSS classes for an entry in the suggestions component
  mentionSuggestionsEntry: mentionSuggestionsEntryStyles.mentionSuggestionsEntry,
  mentionSuggestionsEntryFocused: mentionSuggestionsEntryStyles.mentionSuggestionsEntryFocused,
  mentionSuggestionsEntryText: mentionSuggestionsEntryStyles.mentionSuggestionsEntryText,
  mentionSuggestionsEntryAvatar: mentionSuggestionsEntryStyles.mentionSuggestionsEntryAvatar,
};

export default (config = {}) => {
  const callbacks = {
    keyBindingFn: undefined,
    handleKeyCommand: undefined,
    onDownArrow: undefined,
    onUpArrow: undefined,
    onTab: undefined,
    onEscape: undefined,
    handleReturn: undefined,
    onChange: undefined,
  };

  const ariaProps = {
    ariaHasPopup: 'false',
    ariaExpanded: false,
    ariaOwneeID: undefined,
    ariaActiveDescendantID: undefined,
  };

  let searches = Map();
  let escapedSearch;
  let clientRectFunctions = Map();
  let isOpened;

  const store = {
    getEditorState: undefined,
    setEditorState: undefined,
    getPortalClientRect: (offsetKey) => clientRectFunctions.get(offsetKey)(),
    getAllSearches: () => searches,
    isEscaped: (offsetKey) => escapedSearch === offsetKey,
    escapeSearch: (offsetKey) => {
      escapedSearch = offsetKey;
    },

    resetEscapedSearch: () => {
      escapedSearch = undefined;
    },

    register: (offsetKey) => {
      searches = searches.set(offsetKey, offsetKey);
    },

    updatePortalClientRect: (offsetKey, func) => {
      clientRectFunctions = clientRectFunctions.set(offsetKey, func);
    },

    unregister: (offsetKey) => {
      searches = searches.delete(offsetKey);
      clientRectFunctions = clientRectFunctions.delete(offsetKey);
    },

    getIsOpened: () => isOpened,
    setIsOpened: (nextIsOpened) => { isOpened = nextIsOpened; },
  };

  // Styles are overwritten instead of merged as merging causes a lot of confusion.
  //
  // Why? Because when merging a developer needs to know all of the underlying
  // styles which needs a deep dive into the code. Merging also makes it prone to
  // errors when upgrading as basically every styling change would become a major
  // breaking change. 1px of an increased padding can break a whole layout.
  const {
    mentionPrefix = '',
    theme = defaultTheme,
    positionSuggestions = defaultPositionSuggestions,
    mentionComponent,
    mentionSuggestionsComponent = MentionSuggestions,
    entityMutability = 'SEGMENTED',
    mentionTrigger = '@',
    mentionRegExp = defaultRegExp,
    supportWhitespace = false,
  } = config;
  const mentionSearchProps = {
    ariaProps,
    callbacks,
    theme,
    store,
    entityMutability,
    positionSuggestions,
    mentionTrigger,
    mentionPrefix,
  };
  return {
    MentionSuggestions: decorateComponentWithProps(mentionSuggestionsComponent, mentionSearchProps),
    decorators: [
      {
        strategy: mentionStrategy(mentionTrigger),
        component: decorateComponentWithProps(Mention, { theme, mentionComponent }),
      },
      {
        strategy: mentionSuggestionsStrategy(mentionTrigger, supportWhitespace, mentionRegExp),
        component: decorateComponentWithProps(MentionSuggestionsPortal, { store }),
      },
    ],
    getAccessibilityProps: () => (
      {
        role: 'combobox',
        ariaAutoComplete: 'list',
        ariaHasPopup: ariaProps.ariaHasPopup,
        ariaExpanded: ariaProps.ariaExpanded,
        ariaActiveDescendantID: ariaProps.ariaActiveDescendantID,
        ariaOwneeID: ariaProps.ariaOwneeID,
      }
    ),

    initialize: ({ getEditorState, setEditorState }) => {
      store.getEditorState = getEditorState;
      store.setEditorState = setEditorState;
    },

    keyBindingFn: function keyBindingFn(keyboardEvent) {
      const keyCode = keyboardEvent.which;

      switch (keyCode) {
        case 9: // TAB
          callbacks.onTab && callbacks.onTab(keyboardEvent);
          break;
        case 27: // ESC
          callbacks.onEscape && callbacks.onEscape(keyboardEvent);
          break;
        case 38: // UP
          callbacks.onUpArrow && callbacks.onUpArrow(keyboardEvent);
          break;
        case 40: // DOWN
          callbacks.onDownArrow && callbacks.onDownArrow(keyboardEvent);
          break;
        case 8: // BACKSPACE
        case 46: // DELETE
          const editorState = store.getEditorState();
          const selection = editorState.getSelection();

          if (!selection.isCollapsed()) return;

          const offset = selection.getFocusOffset();
          const content = editorState.getCurrentContent();
          const block = content.getBlockForKey(selection.getFocusKey());
          const text = block.getText();
          const isBackspace = keyCode === 8;

          if (!isZeroWidthChar(text, isBackspace ? offset - 1 : offset)) return;

          const mentionOffset = isBackspace ? offset - 2 : offset + 1;
          let mentionLen = getMentionLength(content, block, mentionOffset);
          const range = {
            anchorOffset: offset,
            focusOffset: offset,
          };

          if (isBackspace) {
            range.anchorOffset -= mentionLen + 1;
            range.anchorOffset -= isZeroWidthChar(text, range.anchorOffset - 1) ? 1 : 0;
          } else {
            range.focusOffset += mentionLen + 1;
            range.focusOffset += isZeroWidthChar(text, range.focusOffset) ? 1 : 0;
          }

          store.setEditorState(
            EditorState.push(
              editorState,
              Modifier.removeRange(
                content,
                selection.merge(range),
                isBackspace ? 'backward' : 'forward'
              ),
              'remove-range'
            )
          );

          return 'handled';
      }

      if (!keyboardEvent.defaultPrevented) {
        const dir = getHorizontalMovement(keyboardEvent) || getEdgeMovement(keyboardEvent);
        if (!dir) return;

        switch (dir) {
          case MOVEMENT.START: return 'move-selection-to-start-of-block';
          case MOVEMENT.END: return 'move-selection-to-end-of-block';
        }

        let editorState = store.getEditorState();
        let selection = editorState.getSelection();

        if (!selection.isCollapsed()) return;

        // handle after event has been handled
        setTimeout(() => {
          editorState = store.getEditorState();
          selection = editorState.getSelection();

          const isLeft = dir === MOVEMENT.LEFT;
          const content = editorState.getCurrentContent();
          const block = content.getBlockForKey(selection.getFocusKey());
          const offset = selection.getFocusOffset();
          const text = block.getText();

          if (!isZeroWidthChar(text, isLeft ? offset : offset - 1)) return;

          const mentionOffset = isLeft ? offset - 1 : offset + 1;
          let mentionLen = getMentionLength(content, block, mentionOffset);
          let targetOffset = offset;

          if (isLeft) {
            targetOffset -= mentionLen;
            targetOffset -= isZeroWidthChar(text, targetOffset - 1) ? 1 : 0;
          } else {
            targetOffset +=  mentionLen;
            targetOffset += isZeroWidthChar(text, targetOffset) ? 1 : 0;
          }

          store.setEditorState(
            EditorState.forceSelection(
              editorState,
              selection.merge({
                anchorOffset: targetOffset,
                focusOffset: targetOffset,
              })
            )
          );
        }, 0);
      }
    },

    handleReturn: (keyboardEvent) => callbacks.handleReturn && callbacks.handleReturn(keyboardEvent),

    onChange: (editorState) => {
      if (callbacks.onChange) return callbacks.onChange(editorState);
      return editorState;
    },
  };
};

export const defaultSuggestionsFilter = suggestionsFilter;
