export interface MaintenanceCategory {
  key: string
  label: string
  items: {
    code: string
    label: string
  }[]
}

const createItemCode = (categoryKey: string, label: string) =>
  `${categoryKey}:${label}`

const createCategory = (
  key: string,
  label: string,
  itemLabels: string[],
): MaintenanceCategory => ({
  key,
  label,
  items: itemLabels.map((itemLabel) => ({
    code: createItemCode(key, itemLabel),
    label: itemLabel,
  })),
})

export const MAINTENANCE_CATEGORIES: MaintenanceCategory[] = [
  createCategory('engine-oil', '엔진/오일류', [
    '엔진오일 교환',
    '엔진오일 교환 SET',
    '엔진오일 보충',
    '오일필터 교환',
    '에어필터 교환',
    '에어컨 필터 교환',
    '연료필터 교환',
    '미션오일 교환',
    '미션오일 보충',
    '디퍼런셜오일 교환',
    '파워스티어링 오일 교환',
    '브레이크오일 교환',
    '냉각수 교환',
    '냉각수 보충',
    '냉각수 리저버 교체',
  ]),
  createCategory('ignition', '점화 계통', [
    '점화플러그 교환',
    '점화코일 교환',
    '점화배선 점검/교체',
    '점화계통 점검',
  ]),
  createCategory('battery', '배터리/충전/시동 계통', [
    '배터리 교체',
    '배터리 충전',
    '배터리 단자 점검/교체',
    '발전기(알터네이터) 점검/교체',
    '레귤레이터 점검/교체',
    '스타터모터 점검/교체',
    '시동계통 점검',
  ]),
  createCategory('lights', '조명 계통', [
    '프론트 전조등 전구 교체',
    '프론트 전조등 어셈블리 점검/교체',
    '프론트 안개등 점검/교체',
    '사이드미러 방향지시등 점검/교체',
    '프론트 방향지시등 점검/교체',
    '리어 방향지시등 점검/교체',
    '후미등 점검/교체',
    '브레이크등 점검/교체',
    '번호판등 점검/교체',
    '실내등 점검/교체',
    '하이마운트 스톱램프 점검/교체',
    '주간주행등(DRL) 점검/교체',
  ]),
  createCategory('electronics', '전장/센서/편의장치', [
    '퓨즈 교체',
    '릴레이 점검/교체',
    '배선 점검/수리',
    '접지 불량 점검',
    '블랙박스 전원 점검',
    '후방카메라 점검/교체',
    '주차센서 점검/교체',
    '와이퍼 모터 점검/교체',
    '윈도우 모터/스위치 점검/교체',
    '에어컨 전장 점검',
    '계기판 경고등 진단',
    'OBD 진단',
    'ECU 관련 점검',
  ]),
  createCategory('brakes', '브레이크', [
    '프론트 브레이크패드 교환',
    '리어 브레이크패드 교환',
    '프론트 브레이크디스크 교환',
    '리어 브레이크디스크 교환',
    '프론트 브레이크캘리퍼 교환',
    '리어 브레이크캘리퍼 교환',
    '브레이크호스 점검/교체',
    'ABS 관련 점검/수리',
  ]),
  createCategory('tires', '타이어/하체', [
    '프론트 타이어 교체',
    '리어 타이어 교체',
    '타이어 위치교환',
    '휠 얼라인먼트',
    '휠 밸런스',
    '서스펜션 점검/교체',
    '변속기 마운트 점검/교체',
    '쇼크업소버 교환',
    '로어암 점검/교체',
    '타이로드엔드 점검/교체',
    '허브베어링 점검/교체',
  ]),
  createCategory('hvac-belt', '냉난방/벨트류', [
    '에어컨 가스 충전',
    '컴프레서 점검/교체',
    '히터 관련 점검/수리',
    '벨트 교환',
    '텐셔너 점검/교체',
    '워터펌프 교환',
  ]),
  createCategory('consumables', '기타 소모품/일반 정비', [
    '와이퍼 교체',
    '워셔액 보충',
    '소모품 점검',
    '정기점검',
    '자동차점검',
    '기타 직접입력',
  ]),
]

export const MAINTENANCE_ITEM_LOOKUP = new Map(
  MAINTENANCE_CATEGORIES.flatMap((category) =>
    category.items.map((item) => [
      item.code,
      {
        categoryKey: category.key,
        categoryLabel: category.label,
        label: item.label,
      },
    ]),
  ),
)
