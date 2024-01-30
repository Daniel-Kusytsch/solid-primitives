/*
 * Copyright 2023 Comcast Cable Communications Management, LLC
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  createEffect,
  on,
  createSignal,
  untrack,
  type Accessor,
} from 'solid-js';
import { useKeyDownEvent } from '@solid-primitives/keyboard';
import { activeElement, ElementNode } from '@lightningjs/solid';
import { isFunc, isArray } from './utils.js';

export interface DefaultKeyMap {
  Left: string | string[];
  Right: string | string[];
  Up: string | string[];
  Down: string | string[];
  Enter: string | string[];
  Last: string | string[];
}

export interface KeyMap extends DefaultKeyMap {}

export type KeyHandlerReturn = boolean | void;

export type KeyHandler = (
  this: ElementNode,
  e: KeyboardEvent,
  target: ElementNode,
) => KeyHandlerReturn;

/**
 * Generates a map of event handlers for each key in the KeyMap
 */
type KeyMapEventHandlers = {
  [K in keyof KeyMap as `on${Capitalize<K>}`]?: KeyHandler;
};

declare module '@lightningjs/solid' {
  /**
   * Augment the existing IntrinsicCommonProps interface with our own
   * FocusManager-specific properties.
   */
  interface IntrinsicCommonProps extends KeyMapEventHandlers {
    onFocus?: (
      currentFocusedElm: ElementNode | undefined,
      prevFocusedElm: ElementNode | undefined,
    ) => void;
    onBlur?: (
      currentFocusedElm: ElementNode | undefined,
      prevFocusedElm: ElementNode | undefined,
    ) => void;
    onKeyPress?: (
      this: ElementNode,
      e: KeyboardEvent,
      mappedKeyEvent: string | undefined,
      currentFocusedElm: ElementNode,
    ) => KeyHandlerReturn;
    onSelectedChanged?: (
      container: ElementNode,
      activeElm: ElementNode,
      selectedIndex: number | undefined,
      lastSelectedIndex: number | undefined,
    ) => void;
    skipFocus?: boolean;
    wrap?: boolean;
    plinko?: boolean;
  }

  interface IntrinsicNodeStyleProps {
    // TODO: Refactor states to use a $ prefix
    focus?: IntrinsicNodeStyleProps;
  }

  interface IntrinsicTextNodeStyleProps {
    // TODO: Refactor states to use a $ prefix
    focus?: IntrinsicTextNodeStyleProps;
  }

  interface TextNode {
    skipFocus?: undefined;
  }
}

const keyMapEntries: Record<string | number, string> = {
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  Enter: 'Enter',
  l: 'Last',
  ' ': 'Space',
  Backspace: 'Back',
  Escape: 'Escape',
  37: 'Left',
  39: 'Right',
  38: 'Up',
  40: 'Down',
  13: 'Enter',
  32: 'Space',
  8: 'Back',
  27: 'Escape',
};

const [focusPath, setFocusPath] = createSignal<ElementNode[]>([]);
export { focusPath };
export const useFocusManager = (userKeyMap?: Partial<KeyMap>) => {
  const keypressEvent = useKeyDownEvent();
  if (userKeyMap) {
    // Flatten the userKeyMap to a hash
    for (const [key, value] of Object.entries(userKeyMap)) {
      if (isArray(value)) {
        value.forEach((v) => {
          keyMapEntries[key] = v;
        });
      } else {
        keyMapEntries[key] = value;
      }
    }
  }
  createEffect(
    on(
      activeElement as Accessor<ElementNode>,
      (
        currentFocusedElm: ElementNode,
        prevFocusedElm: ElementNode | undefined,
        prevFocusPath: ElementNode[] = [],
      ) => {
        const newFocusedElms = [];
        let current = currentFocusedElm;

        const fp: ElementNode[] = [];
        while (current) {
          if (!current.states.has('focus')) {
            current.states.add('focus');
            isFunc(current.onFocus) &&
              current.onFocus.call(current, currentFocusedElm, prevFocusedElm);

            newFocusedElms.push(current);
          }
          fp.push(current);
          current = current.parent!;
        }

        prevFocusPath.forEach((elm) => {
          if (!fp.includes(elm)) {
            elm.states.remove('focus');
            isFunc(elm.onBlur) &&
              elm.onBlur.call(elm, currentFocusedElm, prevFocusedElm);
          }
        });

        setFocusPath(fp);
        return fp;
      },
      { defer: true },
    ),
  );

  createEffect(() => {
    const e = keypressEvent();

    if (e) {
      // Search keyMap for the value of the pressed key
      const mappedKeyEvent = keyMapEntries[e.key];
      untrack(() => {
        const fp = focusPath();
        for (const elm of fp) {
          if (mappedKeyEvent) {
            const onKeyHandler =
              elm[`on${mappedKeyEvent}` as keyof KeyMapEventHandlers];
            if (isFunc(onKeyHandler)) {
              if (onKeyHandler.call(elm, e, elm) === true) {
                break;
              }
            }
          } else {
            console.log(`Unhandled key event: ${e.key}`);
          }

          if (isFunc(elm.onKeyPress)) {
            if (elm.onKeyPress.call(elm, e, mappedKeyEvent, elm) === true) {
              break;
            }
          }
        }
        return false;
      });
    }
  });

  return focusPath;
};
