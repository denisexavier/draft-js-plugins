import { Modifier, EditorState } from 'draft-js';
import getSearchText from '../utils/getSearchText';
import getTypeByTrigger from '../utils/getTypeByTrigger';

const addMention = (editorState, mention, mentionPrefix, mentionTrigger, entityMutability) => {
  const contentStateWithEntity = editorState.getCurrentContent().createEntity(
    getTypeByTrigger(mentionTrigger), entityMutability, { mention }
  );
  const entityKey = contentStateWithEntity.getLastCreatedEntityKey();

  const currentSelectionState = editorState.getSelection();
  const { begin, end } = getSearchText(editorState, currentSelectionState, mentionTrigger);

  let mentionReplacedContent = Modifier.insertText(
    editorState.getCurrentContent(),
    currentSelectionState.merge({
      anchorOffset: begin,
      focusOffset: begin,
    }),
    '\u200B',
  );

  mentionReplacedContent = Modifier.replaceText(
    mentionReplacedContent,
    currentSelectionState.merge({
      anchorOffset: begin + 1,
      focusOffset: end + 1,
    }),
    `${mentionPrefix}${mention.name}`,
    null, // no inline style needed
    entityKey
  );

  mentionReplacedContent = Modifier.insertText(
    mentionReplacedContent,
    mentionReplacedContent.getSelectionAfter(),
    '\u200B',
  );

  // If the mention is inserted at the end, a space is appended right after for
  // a smooth writing experience.
  const blockKey = currentSelectionState.getAnchorKey();
  const blockSize = editorState.getCurrentContent().getBlockForKey(blockKey).getLength();
  if (blockSize === end) {
    mentionReplacedContent = Modifier.insertText(
      mentionReplacedContent,
      mentionReplacedContent.getSelectionAfter(),
      ' ',
    );
  }

  const newEditorState = EditorState.push(
    editorState,
    mentionReplacedContent,
    'insert-mention',
  );
  return {
    newEditorState: EditorState.forceSelection(newEditorState, mentionReplacedContent.getSelectionAfter()),
    entityKey,
  };
};

export default addMention;
