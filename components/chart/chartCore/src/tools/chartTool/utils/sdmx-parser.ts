/**
 * SDMX XML 파서
 * DSD XML과 Generic XML을 파싱하여 LONG 형식 데이터로 변환
 */

import { XMLParser } from "fast-xml-parser";
import * as fs from "fs";
import type {
  Codelist,
  CodelistMap,
  ParsedSDMXData,
  RawObservation,
  SDMXParserOptions,
  DimensionInfo,
  CodelistItem,
} from "@chartCore/src/types/sdmx";

/**
 * SDMX XML 파서 클래스
 */
export class SDMXParser {
  private xmlParser: XMLParser;
  private codelists: CodelistMap = new Map();
  private dimensions: Map<string, DimensionInfo> = new Map();

  constructor() {
    this.xmlParser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      textNodeName: "#text",
    });
  }

  /**
   * DSD XML 파싱
   * Codelist와 Dimension 정보 추출
   */
  private parseDSD(xmlContent: string): void {
    const result = this.xmlParser.parse(xmlContent);

    // Codelists 추출
    const structures = result["mes:Structure"]?.["mes:Structures"];
    if (!structures) {
      throw new Error("DSD XML에서 Structures를 찾을 수 없습니다.");
    }

    // Codelists 파싱
    const codelists = structures["str:Codelists"]?.["str:Codelist"];
    if (codelists) {
      const codelistArray = Array.isArray(codelists) ? codelists : [codelists];

      for (const cl of codelistArray) {
        const codelistId = cl["@_id"];
        const name = this.extractName(cl["com:Name"]);
        const description = cl["com:Description"] ? this.extractName(cl["com:Description"]) : undefined;

        const items: CodelistItem[] = [];
        const codes = cl["str:Code"];
        if (codes) {
          const codeArray = Array.isArray(codes) ? codes : [codes];

          for (const code of codeArray) {
            const codeId = code["@_id"];
            const names = code["com:Name"];
            const nameArray = Array.isArray(names) ? names : [names];

            let nameKo = "";
            let nameEn = "";

            for (const name of nameArray) {
              if (name["@_xml:lang"] === "ko") {
                nameKo = name["#text"] || name;
              } else if (name["@_xml:lang"] === "en") {
                nameEn = name["#text"] || name;
              }
            }

            items.push({
              id: codeId,
              nameKo: nameKo || codeId,
              nameEn: nameEn,
            });
          }
        }

        this.codelists.set(codelistId, {
          id: codelistId,
          name: name,
          description: description,
          items: items,
        });
      }
    }

    // Concepts 파싱 (Dimension 이름 매핑)
    const concepts = structures["str:Concepts"]?.["str:ConceptScheme"]?.["str:Concept"];
    const dimensionNames = new Map<string, { nameKo: string; nameEn: string }>();

    if (concepts) {
      const conceptArray = Array.isArray(concepts) ? concepts : [concepts];

      for (const concept of conceptArray) {
        const conceptId = concept["@_id"];
        const names = concept["com:Name"];
        const nameArray = Array.isArray(names) ? names : [names];

        let nameKo = "";
        let nameEn = "";

        for (const name of nameArray) {
          if (name["@_xml:lang"] === "ko") {
            nameKo = name["#text"] || name;
          } else if (name["@_xml:lang"] === "en") {
            nameEn = name["#text"] || name;
          }
        }

        dimensionNames.set(conceptId, { nameKo, nameEn });
      }
    }

    // DataStructure 파싱 (Dimensions)
    const dataStructure = structures["str:DataStructures"]?.["str:DataStructure"];
    if (dataStructure) {
      const components = dataStructure["str:DataStructureComponents"];
      const dimensionList = components?.["str:DimensionList"];

      // Dimensions 추출
      const dimensions = dimensionList?.["str:Dimension"];
      if (dimensions) {
        const dimArray = Array.isArray(dimensions) ? dimensions : [dimensions];

        for (const dim of dimArray) {
          const dimId = dim["@_id"];
          const position = parseInt(dim["@_position"] || "0", 10);
          const dimNames = dimensionNames.get(dimId) || { nameKo: dimId, nameEn: "" };

          // Codelist 참조 찾기
          let codelistId = undefined;
          const localRep = dim["str:LocalRepresentation"];
          if (localRep?.["str:Enumeration"]?.["Ref"]) {
            codelistId = localRep["str:Enumeration"]["Ref"]["@_id"];
          }

          this.dimensions.set(dimId, {
            id: dimId,
            nameKo: dimNames.nameKo,
            nameEn: dimNames.nameEn,
            position: position,
            codelistId: codelistId,
          });
        }
      }

      // TimeDimension 추출
      const timeDim = dimensionList?.["str:TimeDimension"];
      if (timeDim) {
        const dimId = timeDim["@_id"];
        const position = parseInt(timeDim["@_position"] || "0", 10);
        const dimNames = dimensionNames.get(dimId) || { nameKo: dimId, nameEn: "" };

        this.dimensions.set(dimId, {
          id: dimId,
          nameKo: dimNames.nameKo,
          nameEn: dimNames.nameEn,
          position: position,
        });
      }
    }
  }

  /**
   * Generic XML 파싱
   * Observation 데이터 추출
   */
  private parseGeneric(xmlContent: string): RawObservation[] {
    const result = this.xmlParser.parse(xmlContent);

    const dataSet = result["message:GenericData"]?.["message:DataSet"];
    if (!dataSet) {
      throw new Error("Generic XML에서 DataSet을 찾을 수 없습니다.");
    }

    const observations: RawObservation[] = [];
    const obs = dataSet["generic:Obs"];

    if (obs) {
      const obsArray = Array.isArray(obs) ? obs : [obs];

      for (const o of obsArray) {
        const obsKey = o["generic:ObsKey"]?.["generic:Value"];
        const obsValue = o["generic:ObsValue"];

        if (!obsKey || !obsValue) continue;

        const keyArray = Array.isArray(obsKey) ? obsKey : [obsKey];

        const rawObs: any = {
          OBS_VALUE: parseFloat(obsValue["@_value"] || "0"),
        };

        for (const key of keyArray) {
          const id = key["@_id"];
          const value = key["@_value"];
          rawObs[id] = value;
        }

        observations.push(rawObs as RawObservation);
      }
    }

    return observations;
  }

  /**
   * 코드를 한글명으로 변환
   */
  private codeToKoreanName(codelistId: string, code: string): string {
    const codelist = this.codelists.get(codelistId);
    if (!codelist) return code;

    const item = codelist.items.find((i) => i.id === code);
    return item?.nameKo || code;
  }

  /**
   * Name 요소에서 한글명 추출
   */
  private extractName(nameElement: any): string {
    if (!nameElement) return "";

    const nameArray = Array.isArray(nameElement) ? nameElement : [nameElement];

    for (const name of nameArray) {
      if (name["@_xml:lang"] === "ko") {
        return name["#text"] || name;
      }
    }

    // 한글명이 없으면 첫 번째 값 반환
    return nameArray[0]?.["#text"] || nameArray[0] || "";
  }

  /**
   * Raw Observation을 Parsed SDMX Data로 변환
   */
  private transformToParsedData(rawObs: RawObservation[]): ParsedSDMXData[] {
    const parsed: ParsedSDMXData[] = [];

    for (const raw of rawObs) {
      // 주기 변환 (FREQ)
      const freqDim = this.dimensions.get("FREQ");
      const freqCodelistId = freqDim?.codelistId;
      const 주기 = freqCodelistId ? this.codeToKoreanName(freqCodelistId, raw.FREQ) : raw.FREQ;

      // 계정항목 변환 (ACC_ITEM)
      const accItemDim = this.dimensions.get("ACC_ITEM");
      const accItemCodelistId = accItemDim?.codelistId;
      const 계정항목 = accItemCodelistId ? this.codeToKoreanName(accItemCodelistId, raw.ACC_ITEM) : raw.ACC_ITEM;

      parsed.push({
        시점: raw.TIME_PERIOD,
        주기: 주기,
        계정항목: 계정항목,
        관측값: raw.OBS_VALUE,
      });
    }

    return parsed;
  }

  /**
   * SDMX XML 파일 파싱
   */
  public parse(options: SDMXParserOptions): ParsedSDMXData[] {
    // DSD XML 읽기 및 파싱
    const dsdContent = fs.readFileSync(options.dsdXmlPath, "utf-8");
    this.parseDSD(dsdContent);

    // Generic XML 읽기 및 파싱
    const genericContent = fs.readFileSync(options.genericXmlPath, "utf-8");
    const rawObservations = this.parseGeneric(genericContent);

    // Parsed Data로 변환
    return this.transformToParsedData(rawObservations);
  }
}

/**
 * SDMX XML 파일을 파싱하는 헬퍼 함수
 */
export function parseSDMX(options: SDMXParserOptions): ParsedSDMXData[] {
  const parser = new SDMXParser();
  return parser.parse(options);
}
