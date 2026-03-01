import type { SyntaxNode } from '@lezer/common';
import { parser } from '@lezer/json';

const JSON_VALUE_NODE_NAMES = new Set([
  'Object',
  'Array',
  'String',
  'Number',
  'True',
  'False',
  'Null',
]);

export interface JsonAstRange {
  from: number;
  to: number;
}

function isJsonValueNode(node: SyntaxNode | null): boolean {
  return node !== null && JSON_VALUE_NODE_NAMES.has(node.name);
}

function decodePropertyName(source: string, propertyNameNode: SyntaxNode): string | null {
  const raw = source.slice(propertyNameNode.from, propertyNameNode.to);
  try {
    return JSON.parse(raw) as string;
  } catch {
    return null;
  }
}

function getRootValueNode(topNode: SyntaxNode): SyntaxNode | null {
  for (let child = topNode.firstChild; child; child = child.nextSibling) {
    if (isJsonValueNode(child)) {
      return child;
    }
  }
  return null;
}

function getPropertyValueNode(propertyNode: SyntaxNode): SyntaxNode | null {
  for (let child = propertyNode.firstChild; child; child = child.nextSibling) {
    if (isJsonValueNode(child)) {
      return child;
    }
  }
  return null;
}

function findObjectPropertyNode(
  objectNode: SyntaxNode,
  source: string,
  propertyName: string,
): SyntaxNode | null {
  for (let child = objectNode.firstChild; child; child = child.nextSibling) {
    if (child.name !== 'Property') {
      continue;
    }
    const keyNode = child.getChild('PropertyName');
    if (!keyNode) {
      continue;
    }
    if (decodePropertyName(source, keyNode) === propertyName) {
      return child;
    }
  }
  return null;
}

function findArrayElementNode(arrayNode: SyntaxNode, index: number): SyntaxNode | null {
  let currentIndex = 0;
  for (let child = arrayNode.firstChild; child; child = child.nextSibling) {
    if (!isJsonValueNode(child)) {
      continue;
    }
    if (currentIndex === index) {
      return child;
    }
    currentIndex += 1;
  }
  return null;
}

function clampRange(source: string, node: SyntaxNode | null): JsonAstRange {
  if (source.length === 0) {
    return { from: 0, to: 0 };
  }
  if (!node) {
    return { from: 0, to: 1 };
  }

  const maxIndex = source.length - 1;
  const from = Math.max(0, Math.min(node.from, maxIndex));
  const to = Math.max(from + 1, Math.min(source.length, node.to));
  return { from, to };
}

function findPathNode(source: string, rootNode: SyntaxNode, path: (string | number)[]): SyntaxNode {
  let currentNode: SyntaxNode = rootNode;

  for (const segment of path) {
    if (typeof segment === 'string') {
      if (currentNode.name !== 'Object') {
        return currentNode;
      }

      const propertyNode = findObjectPropertyNode(currentNode, source, segment);
      if (!propertyNode) {
        return currentNode;
      }
      currentNode = getPropertyValueNode(propertyNode) ?? propertyNode;
      continue;
    }

    if (!Number.isInteger(segment) || segment < 0) {
      return currentNode;
    }
    if (currentNode.name !== 'Array') {
      return currentNode;
    }

    const elementNode = findArrayElementNode(currentNode, segment);
    if (!elementNode) {
      return currentNode;
    }
    currentNode = elementNode;
  }

  return currentNode;
}

export interface JsonPathLocator {
  findRange(path: (string | number)[]): JsonAstRange;
}

export function createJsonAstPathLocator(source: string): JsonPathLocator {
  const tree = parser.parse(source);
  const rootNode = getRootValueNode(tree.topNode);
  const defaultNode = rootNode ?? tree.topNode;

  return {
    findRange(path: (string | number)[]): JsonAstRange {
      if (path.length === 0) {
        return clampRange(source, defaultNode);
      }
      if (!rootNode) {
        return clampRange(source, defaultNode);
      }

      return clampRange(source, findPathNode(source, rootNode, path));
    },
  };
}
