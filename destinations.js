const transitSources = {
  yunlin: 'https://www.yunlin.gov.tw/News_Content.aspx?n=1394&s=74395',
  bus: 'https://www.taiwanbus.tw/',
  rail: 'https://www.railway.gov.tw/tra-tip-web/tip/tip001/tip112/querybytime',
  hsr: 'https://www.thsrc.com.tw/ArticleContent/a3b630bb-1066-4352-a1ef-58c7b4e8ef7c',
  hsrStation: 'https://www.thsrc.com.tw/ArticleContent/5f4c7bb0-c676-4e39-8d3c-f12fc188ee5f',
  ubus: 'https://www.ubus.com.tw/Booking/Station/6481/',
  taichungCoach: 'https://www.tcbus.com.tw/',
  shuttle: 'https://www.taiwantrip.com.tw/Frontend/Bustime/TimeTable/R0027',
  xiluo: 'https://louyoung.org.tw/traffic.php'
};

const douliuRail = '臺鐵斗六站';
const dounanRail = '臺鐵斗南站';
const yunlinHsr = '高鐵雲林站';

const destinations = [
  {
    id: 'douliu', name: '斗六火車站', town: '斗六市', lat: 23.71203, lon: 120.54061,
    local: { detail: '從高鐵雲林站可搭 201 快捷公車，在斗六火車站下車。', source: transitSources.hsrStation },
    rail: null,
    hsr: { station: yunlinHsr, detail: '轉搭 201 快捷公車至斗六火車站。', source: transitSources.hsrStation },
    coach: {
      north: { from: '臺北轉運站', detail: '搭統聯 7000 往斗六，依所選班次確認是否須在西螺站轉車。', source: transitSources.ubus }
    }
  },
  {
    id: 'dounan', name: '斗南火車站', town: '斗南鎮', lat: 23.67339, lon: 120.48064,
    local: { detail: '從虎尾市區可查 7102 往斗南的班次，在斗南火車站下車。', source: transitSources.bus },
    rail: null,
    hsr: { station: yunlinHsr, detail: '查詢 7102 往斗南的班次，確認該班是否停靠高鐵站。也可搭 201 至斗六，再轉臺鐵到斗南。', source: transitSources.hsrStation },
    coach: {}
  },
  {
    id: 'yunlin-hsr', name: yunlinHsr, town: '虎尾鎮', lat: 23.73639, lon: 120.41639,
    local: { detail: '斗六出發查 201 快捷公車，北港出發查 301，搭至高鐵雲林站。', source: transitSources.hsrStation },
    rail: { station: douliuRail, detail: '從斗六火車站轉乘 201 快捷公車。', source: transitSources.hsrStation },
    hsr: null,
    coach: {}
  },
  {
    id: 'huwei', name: '雲林布袋戲館', town: '虎尾鎮', lat: 23.70930, lon: 120.43356,
    local: { detail: '從斗六可查 7122 往虎尾，從高鐵雲林站可查停靠虎尾市區的 7102 或 7120，再步行至館址。', source: transitSources.bus },
    rail: { station: dounanRail, detail: '轉乘 7102 往虎尾市區，再步行至雲林布袋戲館。', source: transitSources.bus },
    hsr: { station: yunlinHsr, detail: '查詢經虎尾市區的 7102 或 7120 班次，下車後步行至館址。', source: transitSources.hsrStation },
    coach: {
      north: { from: '臺北轉運站', detail: '查統聯 1635 往虎尾。依班次在西螺站接駁，到虎尾市區後步行至館址。', source: transitSources.ubus }
    }
  },
  {
    id: 'beigang', name: '北港朝天宮', town: '北港鎮', lat: 23.56781, lon: 120.30464,
    local: { detail: '從高鐵雲林站可搭 301 到北港；斗六出發可查 7123 或 7124。抵達北港後步行至朝天宮。', source: transitSources.yunlin },
    rail: { station: douliuRail, detail: '到斗六火車站後站轉搭 7123 或 7124 往北港，再步行至朝天宮。', source: transitSources.bus },
    hsr: { station: yunlinHsr, detail: '轉乘 301 至北港，再步行至朝天宮。', source: transitSources.hsrStation },
    coach: {
      north: { from: '臺北轉運站', detail: '查統聯 1633 或 7001 往北港；7001 依班次在西螺接駁。', source: transitSources.ubus },
      central: { from: '臺中轉運中心', detail: '查 9015 往北港。到北港後步行至朝天宮。', source: transitSources.taichungCoach }
    }
  },
  {
    id: 'xiluo', name: '西螺延平老街', town: '西螺鎮', lat: 23.80151, lon: 120.46190,
    local: { detail: '從虎尾或高鐵雲林站可查 7117 往西螺。抵達西螺轉運站後步行至延平老街。', source: transitSources.xiluo },
    rail: { station: dounanRail, detail: '搭 7102 到虎尾市區，轉搭往西螺的班次，再步行至老街。', source: transitSources.xiluo },
    hsr: { station: yunlinHsr, detail: '查詢有停靠高鐵雲林站的 7117 班次，至西螺轉運站後步行。', source: transitSources.xiluo },
    coach: {
      north: { from: '臺北轉運站', detail: '查統聯 1636，選擇停靠西螺的班次。抵達後步行至老街。', source: transitSources.ubus },
      central: { from: '臺中轉運中心', detail: '查 9016，選擇停靠西螺轉運站的班次。抵達後步行至老街。', source: transitSources.taichungCoach }
    }
  },
  {
    id: 'gukeng', name: '古坑綠色隧道', town: '古坑鄉', lat: 23.659304, lon: 120.540999,
    local: { detail: '從斗六火車站搭台灣好行斗六古坑線，在綠色隧道站下車。', source: transitSources.shuttle },
    rail: { station: douliuRail, detail: '轉搭台灣好行斗六古坑線，在綠色隧道站下車。', source: transitSources.shuttle },
    hsr: { station: yunlinHsr, detail: '搭 201 至斗六火車站，轉台灣好行斗六古坑線至綠色隧道站。', source: transitSources.shuttle },
    coach: {
      north: { from: '臺北轉運站', detail: '查統聯 7000 往斗六，再到斗六火車站轉搭台灣好行斗六古坑線。', source: transitSources.ubus }
    }
  }
];

// 各鄉鎮推薦景點庫（供方案 A 靈感推薦庫使用，含 WGS84 座標；2 公里內符合分類的店家不足十家時延伸至 5 公里）
const townAttractions = {
  douliu: [
    { name: '雲中街生活聚落', desc: '日治木造警察宿舍群與文創聚落', lat: 23.70832, lon: 120.53994 },
    { name: '太平老街', desc: '百年巴洛克建築街屋與古早味小吃', lat: 23.70921, lon: 120.54362 },
    { name: '斗六行啟記念館', desc: '日治紅磚歷史建築與藝文園區', lat: 23.70617, lon: 120.54228 },
    { name: '鵝媽媽鵝童樂園', desc: '親子草原、巨大旋轉木馬', lat: 23.68962, lon: 120.54316 },
    { name: '雅聞峇里海岸觀光工廠', desc: '南洋茅草屋與浪漫人造沙灘', lat: 23.72991, lon: 120.57523 }
  ],
  huwei: [
    { name: '雲林布袋戲館', desc: '日治虎尾郡役所，探索布袋戲歷史', lat: 23.70930, lon: 120.43356 },
    { name: '雲林故事館', desc: '日式木造官邸與日式庭園', lat: 23.70992, lon: 120.43341 },
    { name: '虎尾合同廳舍', desc: '昭和時期消防三級古蹟（誠品/星巴克）', lat: 23.70889, lon: 120.43391 },
    { name: '虎尾百年鐵橋', desc: '鋼桁架百年糖鐵鐵橋與夕陽美景', lat: 23.70112, lon: 120.43555 },
    { name: '虎尾糖廠＆同心公園', desc: '品嚐台糖枝仔冰、漫步老樟樹綠蔭', lat: 23.70321, lon: 120.43512 },
    { name: '澄霖沉香味道森林館', desc: '日式枯山水庭園與浪漫落羽松', lat: 23.72144, lon: 120.45781 }
  ],
  'yunlin-hsr': [
    { name: '澄霖沉香味道森林館', desc: '台版兼六園，夢幻愛心池與落羽松', lat: 23.72144, lon: 120.45781 },
    { name: '雲林布袋戲館', desc: '全台布袋戲重鎮，原虎尾郡役所', lat: 23.70930, lon: 120.43356 },
    { name: '虎尾合同廳舍', desc: '古蹟活化代表，老消防栓與書店', lat: 23.70889, lon: 120.43391 },
    { name: '虎尾糖廠冰品部', desc: '在地人必吃五七糖廠冰棒', lat: 23.70321, lon: 120.43512 }
  ],
  beigang: [
    { name: '北港朝天宮', desc: '國定古蹟媽祖總廟，香火鼎盛', lat: 23.56781, lon: 120.30464 },
    { name: '北港中山路老街', desc: '麻油、狀元餅、鴨肉飯必嚐街區', lat: 23.56651, lon: 120.30431 },
    { name: '北港觀光大橋', desc: '橫跨笨港紅色巨型三拱景觀大橋', lat: 23.56231, lon: 120.30512 },
    { name: '北港武德宮', desc: '台灣五路武財神開基祖廟', lat: 23.58245, lon: 120.30112 },
    { name: '水道頭文化園區', desc: '日治十角自來水塔與綠意生態池', lat: 23.56942, lon: 120.30018 }
  ],
  xiluo: [
    { name: '西螺延平老街', desc: '裝飾派藝術二十年代繁華洋樓街景', lat: 23.80151, lon: 120.46190 },
    { name: '西螺大橋', desc: '昔日遠東第一大紅鋼桁架橋', lat: 23.80482, lon: 120.46211 },
    { name: '丸莊醬油觀光工廠', desc: '百年黑豆純釀醬油與蔭油 DIY', lat: 23.80182, lon: 120.46281 },
    { name: '西螺福興宮（太平媽）', desc: '百年信仰名廟，祈求行車平安', lat: 23.80092, lon: 120.46351 },
    { name: '西螺東市場', desc: '老穀倉變身文創工坊與老街小吃', lat: 23.80191, lon: 120.46081 }
  ],
  gukeng: [
    { name: '古坑綠色隧道', desc: '全長兩公里芒果樹林蔭大道與草皮市集', lat: 23.65930, lon: 120.54099 },
    { name: '華山咖啡園區', desc: '台灣本土咖啡重鎮與絕美景觀餐廳', lat: 23.59329, lon: 120.60091 },
    { name: '劍湖山世界', desc: '知名摩天輪與多元主題遊樂設施', lat: 23.61921, lon: 120.57945 },
    { name: '桂林落羽松步道', desc: '山林間幽靜的落羽松私房景致', lat: 23.59881, lon: 120.60514 }
  ],
  dounan: [
    { name: '他里霧文化園區', desc: '舊火車站鐵道倉庫改裝之藝文空間', lat: 23.67412, lon: 120.48121 },
    { name: '斗南火車站老街小吃', desc: '米糕甲、老冰菓室傳統美味', lat: 23.67611, lon: 120.47741 },
    { name: '偶的家戲偶文創園區', desc: '全台首座布袋戲偶觀光工廠', lat: 23.68212, lon: 120.48911 }
  ]
};

// 各鄉鎮推薦行程庫（供方案 B 智能推薦行程使用）
const recommendedTours = {
  douliu: [
    {
      title: '斗六慢活人文一日遊',
      tag: '文化探索 · 散步街區',
      description: '從火車站出發漫步雲中街日式宿舍群與行啟記念館，走訪百年巴洛克太平老街。',
      stops: [
        { type: 'origin', time: '09:30', name: '斗六火車站', note: '抵達雲林起點' },
        { type: 'spot', time: '10:00', name: '雲中街生活聚落', note: '日式木造古蹟漫步、拍照文創' },
        { type: 'restaurant', isPlaceholder: true, time: '12:00', name: '美食雷達推薦午餐', note: '品嚐火車站周邊 2 公里道地美食' },
        { type: 'spot', time: '14:00', name: '斗六行啟記念館', note: '參觀歷史洋風建築與文藝展覽' },
        { type: 'spot', time: '15:30', name: '太平老街', note: '欣賞昭和日式老街屋、買伴手禮' }
      ]
    },
    {
      title: '親子活力休閒一日遊',
      tag: '親子同樂 · 拍照打卡',
      description: '暢玩巨大旋轉木馬與農莊，午後走訪南洋風沙灘度假風觀光工廠。',
      stops: [
        { type: 'origin', time: '10:00', name: '鵝媽媽鵝童樂園', note: '旋轉木馬、大草坪追逐餵白鵝' },
        { type: 'restaurant', isPlaceholder: true, time: '12:30', name: '美食雷達推薦午餐', note: '享用在地健康特色餐食' },
        { type: 'spot', time: '14:30', name: '雅聞峇里海岸觀光工廠', note: '峇里島風沙灘、香草肥皂香氛' }
      ]
    }
  ],
  huwei: [
    {
      title: '虎尾百年風華經典一日遊',
      tag: '古蹟巡禮 · 糖業歷史',
      description: '漫遊日治郡役所布袋戲館與合同廳舍，午後品嚐台糖冰品、走過百年鐵橋。',
      stops: [
        { type: 'origin', time: '09:30', name: '雲林布袋戲館', note: '探索台灣布袋戲歷史與精美戲偶' },
        { type: 'spot', time: '11:00', name: '虎尾合同廳舍', note: '歷史消防栓古蹟結合星巴克與誠品' },
        { type: 'restaurant', isPlaceholder: true, time: '12:00', name: '美食雷達推薦午餐', note: '享受虎尾在地人氣老店' },
        { type: 'spot', time: '13:30', name: '虎尾糖廠＆同心公園', note: '品嚐傳統台糖枝仔冰、看老火車頭' },
        { type: 'spot', time: '15:30', name: '虎尾百年鐵橋', note: '漫步日治鋼架鐵橋眺望新虎尾溪' }
      ]
    },
    {
      title: '日式庭園芬多精半日遊',
      tag: '自然休閒 · 綠意放鬆',
      description: '置身台版兼六園澄霖沉香館，享受森林芬多精與浪漫愛心池。',
      stops: [
        { type: 'origin', time: '10:00', name: '澄霖沉香味道森林館', note: '日式庭園漫步、沈香精油體驗' },
        { type: 'restaurant', isPlaceholder: true, time: '12:30', name: '美食雷達推薦午餐', note: '周邊美味餐館用餐' },
        { type: 'spot', time: '14:30', name: '雲林故事館', note: '坐在日式榻榻米屋簷下聽在地故事' }
      ]
    }
  ],
  'yunlin-hsr': [
    {
      title: '高鐵便捷快閃虎尾一日遊',
      tag: '大眾運輸 · 高鐵精選',
      description: '從高鐵站無縫轉乘，串連沉香森林公園與虎尾文化街區。',
      stops: [
        { type: 'origin', time: '10:00', name: '高鐵雲林站', note: '快捷抵達雲林' },
        { type: 'spot', time: '10:30', name: '澄霖沉香味道森林館', note: '拍照打卡落羽松與兼六園日式景致' },
        { type: 'restaurant', isPlaceholder: true, time: '12:30', name: '美食雷達推薦午餐', note: '品嚐虎尾市區經典小吃' },
        { type: 'spot', time: '14:00', name: '雲林布袋戲館', note: '參觀古典紅磚郡役所' },
        { type: 'spot', time: '16:00', name: '高鐵雲林站', note: '搭乘接駁返程，輕鬆結束充實行程' }
      ]
    }
  ],
  beigang: [
    {
      title: '北港媽祖祈福＆老街美食巡禮',
      tag: '宗教祈福 · 在地美味',
      description: '參拜全台媽祖信仰中心朝天宮，品嚐古早味鴨肉飯，走訪觀光大橋與文化水塔。',
      stops: [
        { type: 'origin', time: '09:30', name: '北港朝天宮', note: '參拜天上聖母媽祖，祈求旅途平安' },
        { type: 'spot', time: '11:00', name: '北港中山路老街', note: '品尝北港圓仔湯、假魚肚羹、手作麻油' },
        { type: 'restaurant', isPlaceholder: true, time: '12:30', name: '美食雷達推薦午餐', note: '朝天宮周邊在地鴨肉飯老店' },
        { type: 'spot', time: '14:00', name: '北港觀光大橋', note: '散步龍形紅色大橋，眺望北港溪' },
        { type: 'spot', time: '15:30', name: '水道頭文化園區', note: '參觀日治十角自來水塔與綠池古木' }
      ]
    }
  ],
  xiluo: [
    {
      title: '西螺大橋夕陽與百年醬香遊',
      tag: '產業體驗 · 歷史老街',
      description: '穿梭西螺延平老街洋樓，體驗百年丸莊黑豆蔭油釀造，傍晚漫步西螺大橋看夕陽。',
      stops: [
        { type: 'origin', time: '10:00', name: '西螺延平老街', note: '欣賞昭和時期巴洛克立面老洋樓' },
        { type: 'spot', time: '11:00', name: '丸莊醬油觀光工廠', note: '參觀百年醬缸曬場，體驗蔭油文化' },
        { type: 'restaurant', isPlaceholder: true, time: '12:30', name: '美食雷達推薦午餐', note: '老街東市場品嚐在地九層粿、小吃' },
        { type: 'spot', time: '14:00', name: '西螺福興宮（太平媽）', note: '參拜西螺媽祖' },
        { type: 'spot', time: '16:00', name: '西螺大橋', note: '漫步鋼桁大紅橋，欣賞濁水溪壯闊日落' }
      ]
    }
  ],
  gukeng: [
    {
      title: '古坑綠蔭漫遊與台灣咖啡森活遊',
      tag: '自然森林 · 咖啡香氣',
      description: '在綠色隧道草地森呼吸，午後上華山俯瞰平原美景，品味正統古坑手沖咖啡。',
      stops: [
        { type: 'origin', time: '10:00', name: '古坑綠色隧道', note: '漫步芒果老樹大道、逛特色小農市集' },
        { type: 'restaurant', isPlaceholder: true, time: '12:30', name: '美食雷達推薦午餐', note: '周邊美味風味餐或在地美食' },
        { type: 'spot', time: '14:30', name: '華山咖啡園區', note: '造訪景觀咖啡廳，手沖咖啡體驗' },
        { type: 'spot', time: '16:30', name: '桂林落羽松步道', note: '山林間慢步吸收芬多精' }
      ]
    }
  ],
  dounan: [
    {
      title: '斗南藝文倉庫與懷舊小吃巡禮',
      tag: '鐵道藝文 · 巷弄美食',
      description: '探索由老糖鐵與臺鐵倉庫改建的他里霧文化園區，品嚐傳承甲子老店小吃。',
      stops: [
        { type: 'origin', time: '10:00', name: '他里霧文化園區', note: '繪本館、生活美學館散步與閱讀' },
        { type: 'restaurant', isPlaceholder: true, time: '12:00', name: '美食雷達推薦午餐', note: '斗南車站前米糕甲、蚵仔麵線' },
        { type: 'spot', time: '14:00', name: '偶的家戲偶文創園區', note: '體驗布袋戲偶彩繪製作工藝' }
      ]
    }
  ]
};
