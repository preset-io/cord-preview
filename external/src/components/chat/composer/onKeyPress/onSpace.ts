import type * as React from 'react';
import { Element, Editor, Node, Transforms, Text, Range, Path } from 'slate';
import { isMessageNodeType } from '@cord-sdk/react/common/lib/messageNode.ts';
import { MessageNodeType } from 'common/types/index.ts';
import type { EditorShortcut } from 'external/src/editor/commands.ts';
import {
  EDITOR_SHORTCUTS,
  EditorCommands,
} from 'external/src/editor/commands.ts';

export function onSpace(
  editor: Editor,
  event: React.KeyboardEvent,
  enableTasks: boolean,
) {
  const { selection } = editor;
  if (!selection || !Range.isCollapsed(selection)) {
    return;
  }
  const { offset, path } = selection.anchor;

  // Add bullets, quotes etc
  const currentNode = Node.get(editor, path);
  const parent = Node.parent(editor, path);
  const superParent = Node.get(editor, Path.parent(Path.parent(path)));
  if (
    Text.isText(currentNode) &&
    // Only if the user is positioned in the first three characters of the element
    1 <= offset &&
    offset <= 3 &&
    isMessageNodeType(parent, MessageNodeType.PARAGRAPH)
  ) {
    const text = currentNode.text.slice(0, offset);
    const shortcut: EditorShortcut | undefined = EDITOR_SHORTCUTS[text];
    if (shortcut) {
      if (shortcut.type === MessageNodeType.TODO && !enableTasks) {
        return;
      }
      // If the relevant parent is the editor itself, we can always insert,
      // otherwise check we can insert into that kind of node
      if (
        Editor.isEditor(superParent) ||
        (Element.isElement(superParent) &&
          shortcut.validIn.includes(superParent.type))
      ) {
        event.preventDefault();
        Transforms.delete(editor, {
          distance: offset,
          unit: 'character',
          reverse: true,
        });
        EditorCommands.transformToBlock(editor, shortcut.type);
        return;
      }
    }
  }
}
