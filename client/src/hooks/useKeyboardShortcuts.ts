import { useEffect } from 'react';

interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  action: () => void;
  description: string;
}

interface UseKeyboardShortcutsOptions {
  enabled?: boolean;
  preventDefault?: boolean;
}

/**
 * Custom hook for handling keyboard shortcuts
 * 
 * @param shortcuts Array of keyboard shortcut definitions
 * @param options Configuration options
 * 
 * @example
 * useKeyboardShortcuts([
 *   {
 *     key: 's',
 *     ctrlKey: true,
 *     action: () => save(),
 *     description: 'Save project'
 *   }
 * ]);
 */
export function useKeyboardShortcuts(
  shortcuts: KeyboardShortcut[],
  options: UseKeyboardShortcutsOptions = {}
) {
  const { enabled = true, preventDefault = true } = options;

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs, textareas, or contenteditable elements
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        (target.closest('[contenteditable="true"]') !== null)
      ) {
        // Allow Escape to close dialogs/modals even when typing
        if (event.key === 'Escape') {
          // Let it bubble up for dialog closing
          return;
        }
        return;
      }

      for (const shortcut of shortcuts) {
        const keyMatches = event.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatches = shortcut.ctrlKey ? (event.ctrlKey || event.metaKey) : !event.ctrlKey && !event.metaKey;
        const shiftMatches = shortcut.shiftKey === undefined ? true : event.shiftKey === shortcut.shiftKey;
        const altMatches = shortcut.altKey === undefined ? true : event.altKey === shortcut.altKey;

        if (keyMatches && ctrlMatches && shiftMatches && altMatches) {
          if (preventDefault) {
            event.preventDefault();
          }
          shortcut.action();
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [shortcuts, enabled, preventDefault]);
}

/**
 * Helper to create a keyboard shortcut definition
 */
export function createShortcut(
  key: string,
  action: () => void,
  description: string,
  modifiers: {
    ctrl?: boolean;
    meta?: boolean;
    shift?: boolean;
    alt?: boolean;
  } = {}
): KeyboardShortcut {
  return {
    key,
    ctrlKey: modifiers.ctrl || modifiers.meta,
    metaKey: modifiers.meta,
    shiftKey: modifiers.shift,
    altKey: modifiers.alt,
    action,
    description,
  };
}

