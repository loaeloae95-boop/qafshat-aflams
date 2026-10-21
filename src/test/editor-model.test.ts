import { describe, expect, it } from "vitest";
import {
  projectTotal,
  segAt,
  splitAud,
  splitSegs,
  trimAud,
  type Aud,
  type Seg,
} from "@/lib/editor-model";

const seg = (id: string, i: number, o: number): Seg => ({
  id,
  kind: "video",
  src: "x",
  name: "",
  in: i,
  out: o,
  srcDur: 10,
  mute: false,
});
const aud: Aud = {
  id: "a",
  src: "y",
  name: "",
  in: 0,
  out: 6,
  srcDur: 6,
  start: 2,
  volume: 1,
  mute: false,
};

describe("editor timeline", () => {
  it("finds the segment under the playhead", () => {
    const h = segAt([seg("1", 0, 4), seg("2", 2, 5)], 5);
    expect(h?.seg.id).toBe("2");
    expect(h?.local).toBe(3);
  });
  it("splits a video segment at the playhead into two", () => {
    const r = splitSegs([seg("1", 0, 4)], 1.5);
    expect(r.map((s) => [s.in, s.out])).toEqual([
      [0, 1.5],
      [1.5, 4],
    ]);
  });
  it("splits an audio clip keeping its timeline position", () => {
    const r = splitAud([aud], "a", 4);
    expect(r[1]!.start).toBe(4);
    expect(r[1]!.in).toBe(2);
    expect(r[0]!.out).toBe(2);
  });
  it("left-trimming audio moves its start with the content", () => {
    const r = trimAud(aud, "l", 1);
    expect([r.in, r.start]).toEqual([1, 3]);
  });
  it("project length covers audio running past the video", () => {
    expect(projectTotal([seg("1", 0, 3)], [aud])).toBe(8);
  });
});
