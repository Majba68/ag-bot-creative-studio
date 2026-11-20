import assert from 'node:assert/strict'
import test from 'node:test'
import { buildHorrorTrackingPrompt, parseHorrorTrackingResponse } from '../horrorTracking.js'

test('horror tracking parser keeps normalized cup and ball boxes with visual status', () => {
  const response = {
    enoughEvidence: true,
    confidence: 0.82,
    note: 'Three inverted cups and one bright ball are visible.',
    objects: [
      { class: 'cup', x: 200, y: 700, w: 120, h: 210, confidence: 0.9, status: 'visible' },
      { class: 'cup', x: 500, y: 700, w: 120, h: 210, confidence: 0.86, status: 'visible' },
      { class: 'cup', x: 800, y: 700, w: 120, h: 210, confidence: 0.8, status: 'occluded' },
      { class: 'ball', x: 505, y: 380, w: 60, h: 60, confidence: 0.74, status: 'visible' },
      { class: 'ball', x: 510, y: 385, w: 60, h: 60, confidence: 0.55, status: 'uncertain' },
      { class: 'ball', x: 515, y: 390, w: 60, h: 60, confidence: 0.4, status: 'visible' },
      { class: 'dog', x: 100, y: 100, w: 50, h: 50, confidence: 0.9, status: 'visible' },
    ],
  }

  const result = parseHorrorTrackingResponse(JSON.stringify(response), 4, 1.5)

  assert.equal(result.enoughEvidence, true)
  assert.equal(result.frameIndex, 4)
  assert.equal(result.timeSec, 1.5)
  assert.equal(result.objects.filter((object) => object.class === 'cup').length, 3)
  assert.equal(result.objects.filter((object) => object.class === 'ball').length, 2)
  assert.equal(result.objects[0].x, 0.2)
  assert.equal(result.objects[0].y, 0.7)
  assert.equal(result.objects[0].w, 0.12)
  assert.equal(result.objects[3].status, 'visible')
  assert.equal(result.objects[4].status, 'uncertain')
  assert.equal(result.confidence, 0.82)
})

test('insufficient evidence clears all detections even when the model lists objects', () => {
  const response = {
    enoughEvidence: false,
    confidence: 0.9,
    note: 'The frame is too dark to identify objects.',
    objects: [
      { class: 'cup', x: 500, y: 500, w: 100, h: 200, confidence: 0.8, status: 'visible' },
    ],
  }

  const result = parseHorrorTrackingResponse(JSON.stringify(response), 0, 0)

  assert.equal(result.enoughEvidence, false)
  assert.deepEqual(result.objects, [])
  assert.equal(result.confidence, 0)
  assert.match(result.note, /too dark/)
})

test('parser clamps invalid boxes and rejects missing evidence decision', () => {
  const response = {
    enoughEvidence: true,
    confidence: 0.7,
    note: 'One cup is visible near the edge.',
    objects: [
      { class: 'cup', x: 1500, y: -200, w: 3000, h: 40, confidence: 100, status: 'partially_visible' },
    ],
  }
  const result = parseHorrorTrackingResponse(JSON.stringify(response), 2, 0.5)

  assert.equal(result.objects.length, 1)
  assert.equal(result.objects[0].x, 0.55)
  assert.equal(result.objects[0].y, 0.02)
  assert.equal(result.objects[0].w, 0.9)
  assert.equal(result.objects[0].h, 0.04)
  assert.equal(result.objects[0].confidence, 1)
  assert.equal(result.objects[0].status, 'occluded')

  assert.throws(() => parseHorrorTrackingResponse('{"confidence":0.5,"objects":[]}', 0, 0), /evidence decision/)
})

test('tracking prompt asks for normalized boxes and forbids invented objects', () => {
  const prompt = buildHorrorTrackingPrompt(7, 2.75)

  assert.match(prompt, /frame 7/)
  assert.match(prompt, /2\.75 seconds/)
  assert.match(prompt, /0\.\.1000 integers/)
  assert.match(prompt, /at most 3 cups and at most 2 balls/)
})
