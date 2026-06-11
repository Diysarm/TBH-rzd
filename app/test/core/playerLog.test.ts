import { describe, it, expect } from "vitest";
import { parseGetBoxCountItemKeys, playerLogPathFromSave } from "../../src/core/playerLog";

describe("playerLog", () => {
  it("derives Player.log path from save path", () => {
    expect(
      playerLogPathFromSave(
        "C:\\Users\\me\\AppData\\LocalLow\\TesseractStudio\\TaskbarHero\\SaveFile_Live.es3",
      ),
    ).toBe("C:\\Users\\me\\AppData\\LocalLow\\TesseractStudio\\TaskbarHero\\Player.log");
  });

  it("parses GetBoxCount Success lines", () => {
    const chunk = `
GetBoxCount Success Count : 1 // ItemKey : 920501
UnityEngine.Debug:Log(Object)
GetBoxCount Success Count : 1 // ItemKey : 920151
`;
    expect(parseGetBoxCountItemKeys(chunk)).toEqual([920501, 920151]);
  });

  it("ignores unrelated log lines", () => {
    expect(parseGetBoxCountItemKeys("Some other log line\n")).toEqual([]);
  });
});
