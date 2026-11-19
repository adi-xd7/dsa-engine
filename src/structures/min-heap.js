export class MinHeap {
  #items = [];
  #compare;

  constructor(compare) {
    this.#compare = compare;
  }

  static from(array, compare) {
    const heap = new MinHeap(compare);
    heap.#items = [...array];
    for (let i = Math.floor(heap.#items.length / 2) - 1; i >= 0; i--) {
      heap.#siftDown(i);
    }
    return heap;
  }

  get size() {
    return this.#items.length;
  }

  push(item) {
    this.#items.push(item);
    this.#siftUp(this.#items.length - 1);
  }

  pop() {
    const items = this.#items;
    if (items.length === 0) return undefined;
    const top = items[0];
    const last = items.pop();
    if (items.length > 0) {
      items[0] = last;
      this.#siftDown(0);
    }
    return top;
  }

  #siftUp(i) {
    const items = this.#items;
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2);
      if (this.#compare(items[i], items[parent]) >= 0) return;
      [items[i], items[parent]] = [items[parent], items[i]];
      i = parent;
    }
  }

  #siftDown(i) {
    const items = this.#items;
    const n = items.length;
    while (true) {
      const left = 2 * i + 1;
      const right = left + 1;
      let smallest = i;
      if (left < n && this.#compare(items[left], items[smallest]) < 0)
        smallest = left;
      if (right < n && this.#compare(items[right], items[smallest]) < 0)
        smallest = right;
      if (smallest === i) return;
      [items[i], items[smallest]] = [items[smallest], items[i]];
      i = smallest;
    }
  }
}
