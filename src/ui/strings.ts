// ข้อความบนจอทุกคำอยู่ที่นี่ · ไทยกับอังกฤษ เลือกได้ในหน้าตั้งค่า ไม่ปนสองภาษาในจอเดียว

export type Lang = 'th' | 'en';

const th = {
  // ส่วนบนจอ
  stamina: 'แรง',
  oxygen: 'ออกซิเจน',
  battery: 'แบตไฟฉาย',
  minimapHint: 'กด M ดูแผนที่จอใหญ่',
  compassN: 'N', compassNE: 'NE', compassE: 'E', compassSE: 'SE', compassS: 'S', compassSW: 'SW', compassW: 'W', compassNW: 'NW',
  armUR: 'แขนบนขวา', armUL: 'แขนบนซ้าย', armLR: 'แขนล่างขวา', armLL: 'แขนล่างซ้าย',
  main: 'หลัก',
  empty: 'ว่าง',
  keyLeft: 'คลิกซ้าย', keyRight: 'คลิกขวา',
  beltHint: 'จุดฟ้ามุมช่อง = ถืออยู่ในแขน · กดเลขเอาของเข้าแขนหลัก',
  // อุปกรณ์
  scanner: 'เครื่องสแกน', flashlight: 'ไฟฉาย', inkGun: 'ปืนปลาหมึก', glueGun: 'ปืนกาว', climber: 'ที่ปีนป่าย', oxygenTank: 'ถังออกซิเจน',
  bagSmall: 'กระเป๋าใบเล็ก', bagMedium: 'กระเป๋าใบกลาง', bagLarge: 'กระเป๋าใบใหญ่',
  short_scanner: 'สแกน', short_flashlight: 'ไฟฉาย', short_inkGun: 'ปืนหมึก', short_glueGun: 'ปืนกาว', short_climber: 'ที่ปีน', short_oxygenTank: 'ออกซิเจน', short_bag: 'กระเป๋า',
  on: 'เปิดอยู่', off: 'ปิดอยู่',
  ink: 'หมึก', glue: 'กาว', tanks: 'ถัง', charge: 'แบต',
  // ใช้อุปกรณ์
  scanning: 'กำลังสแกน', scanNothing: 'ไม่มีอะไรให้สแกนตรงนี้', scanSent: 'ส่งผลสแกนเข้ายานแล้ว',
  lightEmpty: 'แบตไฟฉายหมด รอแดดชาร์จ', noInk: 'หมึกหมด', noGlue: 'กาวหมด', noCracks: 'โหลไม่มีรอยร้าว', sealed: 'อุดรอยร้าวแล้ว',
  oxygenFull: 'ออกซิเจนในโหลเต็มอยู่แล้ว', oxygenRefilled: 'เติมออกซิเจนในโหลแล้ว', noTanks: 'ถังออกซิเจนหมด',
  bagHint: 'กด Tab หรือ I เพื่อเปิดกระเป๋า', charging: 'กำลังชาร์จแดด',
  // หน้ากระเป๋า คอลเลกชัน ยาน
  tabBag: 'กระเป๋า', tabCollection: 'คอลเลกชัน', closeTab: 'ปิดหน้านี้',
  bagOf: 'กระเป๋า', noBag: 'ไม่ได้พกกระเป๋า ของที่เก็บจะถือไว้ในช่องว่างของแถบล่าง',
  gearKg: 'อุปกรณ์', itemsKg: 'ของที่เก็บ', totalKg: 'รวม', kg: 'กก.',
  dropBag: 'วางกระเป๋าใบนี้ไว้ตรงนี้', nestBag: 'ใส่ลงในกระเป๋าใบอื่น', unnestBag: 'เอากระเป๋าที่ซ้อนออกมา', nested: 'ซ้อน',
  armSlots: 'ช่องแขน · ลากของมาวาง หรือคลิกของแล้วคลิกแขน', body: 'ร่างกาย', jarOk: 'โหล ไม่มีรอยร้าว', jarCracks: 'โหลร้าว', jarO2: 'ออกซิเจนในโหล', temp: 'อุณหภูมิ', tempOk: 'ปกติ', tempCold: 'หนาว',
  dragRotate: 'ลากเมาส์เพื่อหมุน', pickHint: 'คลิกของในกระเป๋าเพื่อดู',
  catAll: 'ทั้งหมด', catHuman: 'ของมนุษย์', catAnimal: 'สัตว์', catPlant: 'พืช', catSelf: 'ร่องรอยของฉัน',
  unknown: '???', layer1: 'ชั้นที่ 1 · ฉันเดาว่า', layer2: 'ชั้นที่ 2 · ความจริง', layer3: 'ชั้นที่ 3 · บันทึกของฉัน',
  lockTruth: 'สแกนของชนิดนี้ให้ครบ 3 ชิ้นเพื่อปลดล็อก', lockLog: 'ยังไม่มี', noLog: 'ของชนิดนี้ไม่มีบันทึกส่วนตัว',
  smallObj: 'ของชิ้นเล็ก เก็บได้', largeObj: 'ของใหญ่ สแกนได้อย่างเดียว', deposited: 'อยู่ในยาน', scanned: 'สแกนแล้ว', notFound: 'ยังไม่เจอ',
  shipTitle: 'ยาน · เตรียมออกสำรวจ', shipSub: 'ยานจำลองอุปกรณ์ได้ไม่จำกัด', starter: 'แพ็กเกจเริ่มต้น', depart: 'ออกเดินทาง',
  shipStock: 'ของในยาน · คลิกเพื่อหยิบหรือวางคืน · กด + − เพื่อกำหนดจำนวน', willCarry: 'จะพกไป · แถบล่าง 9 ช่อง', armsOnDepart: 'ใส่แขนไว้ตอนออกจากยาน', carryWeight: 'น้ำหนักที่แบก',
  taken: 'หยิบแล้ว', notTaken: 'ยังไม่หยิบ', capKg: 'รับได้', weightNote: 'ยิ่งหนัก แรงยิ่งลดเร็วตอนวิ่ง ว่าย และปีน · เกินที่แบกได้จะเก็บของเพิ่มไม่ได้', slotsFull: 'แถบล่างเต็ม 9 ช่องแล้ว',
  warmth: 'อุ่นร่างกาย', warmOk: 'อยู่ในยาน · อุ่นเต็มแล้ว', depositedN: 'ฝากของเข้าคอลเลกชันแล้ว {n} ชิ้น', nothingDeposited: 'ไม่มีของให้ฝาก',
  // ในโลก
  pick: 'เก็บ', enterShip: 'เข้ายาน', takeBag: 'หยิบกระเป๋า', beacon: 'ส่งสัญญาณเข้าแผนที่', beaconOn: 'กระเป๋าส่งสัญญาณแล้ว', bagFull: 'แบกไม่ไหวแล้ว ต้องกลับยานไปเก็บของก่อน',
  pickedBag: 'เก็บใส่กระเป๋าแล้ว', pickedHand: 'ถือไว้ในแถบล่าง', bagDropped: 'วางกระเป๋าไว้แล้ว ยังไม่ได้ส่งสัญญาณ', newLayer: 'ปลดล็อก', scanTarget: 'กำลังมอง',
  // ร่างกายและความตาย
  cold: 'หนาว · น้ำแข็งกำลังลามเข้ากระจก', cracked: 'โหลร้าว', sealWithGlue: 'ใช้ปืนกาวอุด', oxygenLow: 'ออกซิเจนในโหลกำลังลด',
  deathFall: 'โหลแตก', deathAnimal: 'โหลแตก', deathDrown: 'ปลาหมึกขาดใจ', deathGas: 'ปลาหมึกขาดใจ', deathCold: 'หนาวตาย',
  causeFall: 'ตกจากที่สูง', causeAnimal: 'สัตว์ดุทำร้าย', causeDrown: 'จมน้ำ ออกซิเจนในโหลหมด', causeGas: 'ก๊าซพิษในถ้ำ ออกซิเจนในโหลหมด', causeCold: 'อยู่กลางความหนาวนานเกินไป',
  quoteFall: '"ฉันคิดว่าข้างล่างนั้นมีอะไรรออยู่ ฉันคิดผิด"', quoteAnimal: '"มันไม่ได้เกลียดฉัน มันแค่กลัว เหมือนที่ฉันกลัวมัน"',
  quoteDrown: '"น้ำข้างนอกกับน้ำในโหลดูเหมือนกัน แต่มันไม่ใช่"', quoteGas: '"ความมืดในถ้ำไม่ได้น่ากลัวเท่าอากาศในนั้น"', quoteCold: '"ดาวสวยมากคืนนี้ ฉันมองนานเกินไป"',
  bodyN: 'ร่างที่', ended: 'สิ้นสุด', cloning: 'ยานกำลังจำลองร่างใหม่', allDropped: 'ของทุกอย่างตกอยู่ที่ซาก', deathMarked: 'จุดตายขึ้นบนแผนที่แล้ว',
  gearN: 'อุปกรณ์', itemsN: 'ของที่เก็บ', pieces: 'ชิ้น', takeFromBody: 'เก็บของจากซาก', bodyEmpty: 'ซากนี้ไม่มีของเหลือแล้ว', tookFromBody: 'เก็บของคืนจากซากแล้ว', bodySomeLeft: 'แถบล่างเต็ม ของบางชิ้นยังอยู่ที่ซาก',
  respawned: 'ระบบในยานจำลองร่างใหม่แล้ว เลือกของก่อนออกเดินทาง', warmNearShip: 'อุ่นขึ้นแล้ว',
  inkLabel: 'ผลของหมึก', inkFlee: 'โดนหมึกแล้วตกใจหนี ตัวเหนียวช้าลง', inkIgnore: 'โดนหมึกแล้วเฉย ๆ แต่ตัวเหนียวเคลื่อนไหวช้าลง', inkEnraged: 'โดนหมึกแล้วดุร้ายกว่าเดิม ระวัง', attacked: 'โดนทำร้าย โหลร้าว',
  // หน้าเริ่มเกม ตั้งค่า
  gameTitle: 'ร่องรอย', tagline: 'สิ่งที่มนุษย์ทิ้งไว้ บนดาวที่ไม่มีใครเหลืออยู่แล้ว', continueGame: 'เล่นต่อ', dayN: 'วันที่', discoveries: 'ค้นพบ', things: 'อย่าง',
  newGame: 'เริ่มสำรวจใหม่', newGameConfirm: 'เริ่มใหม่จะลบความคืบหน้าเดิม กดอีกครั้งเพื่อยืนยัน', settings: 'ตั้งค่า', quitGame: 'ออกจากเกม', quitNote: 'บันทึกแล้ว ปิดแท็บนี้ได้เลย', demoVer: 'เดโม',
  worldMoved: 'โลกขยายเป็น 3 × 3 กม. แล้ว · เริ่มใหม่ที่ยาน คอลเลกชันกับของที่พกยังอยู่ครบ',
  loadingLand: 'กำลังปั้นภูเขา หุบเขา แม่น้ำ', loadingLife: 'กำลังปลูกป่า วางเมือง และของในโลก',
  paused: 'หยุดเกม', toTitle: 'ออกไปหน้าแรก', resume: 'เล่นต่อ', gfxAudio: 'ภาพและเสียง', language: 'ภาษา', langThai: 'ไทย', langEnglish: 'English',
  quality: 'ความละเอียดภาพ', qLow: 'ต่ำ', qMed: 'กลาง', qHigh: 'สูง', viewDist: 'ระยะมองเห็น', natureVol: 'เสียงธรรมชาติ', gearVol: 'เสียงอุปกรณ์', mouseSens: 'ความไวเมาส์',
  progress: 'ความคืบหน้า', autoSaved: 'บันทึกในเบราว์เซอร์เครื่องนี้อัตโนมัติ', controls: 'ปุ่มบังคับ', saved: 'บันทึกแล้ว',
  kMove: 'เดิน', kLook: 'หมุนกล้อง', kRun: 'วิ่ง', kJump: 'กระโดด', kInteract: 'เก็บของ · ใช้ของในโลก', kArmsTop: 'ใช้ของในแขนบนขวา / แขนบนซ้าย', kArmsLow: 'ใช้ของในแขนล่างขวา / แขนล่างซ้าย',
  kNum: 'เอาของเข้าแขนหลัก', kBag: 'กระเป๋า · คอลเลกชัน', kMap: 'แผนที่จอใหญ่', kEsc: 'หยุดเกม', kShoulder: 'สลับไหล่กล้อง', kJarLight: 'เปิดปิดไฟในโถ', kBeacon: 'กระเป๋าส่งสัญญาณ',
  keyMouse: 'เมาส์', keyNums: '1 ถึง 9', keyTabI: 'Tab หรือ I', keyLR: 'คลิกซ้าย / คลิกขวา', keyWheel: 'ลูกกลิ้ง', kWheel: 'เลื่อนของในแขนหลัก',
  // แผนที่
  map: 'แผนที่', mapSub: 'สำรวจแล้ว', close: 'ปิด',
  legend: 'สัญลักษณ์', legShip: 'ยาน', legMe: 'ตัวฉัน', legDeath: 'จุดตายล่าสุด · ของยังอยู่', legOldBody: 'ซากเก่า · ของหายแล้ว', legBag: 'กระเป๋าที่ส่งสัญญาณ',
  mapNote1: 'กระเป๋าที่วางแล้วลืมกดส่งสัญญาณ จะไม่ขึ้นบนแผนที่ ต้องเดินหาเอง',
  mapNote2: 'พื้นที่มืดคือที่ยังไม่เคยไป',
  ship: 'ยาน',
  km: 'กม.',
  mapZoomHint: 'ลูกกลิ้งซูม · ลากเพื่อเลื่อน · ดับเบิลคลิกดูทั้งแมพ', mapBodyN: 'ร่างที่ {n}', bagMark: 'กระเป๋า',
  placeTown: 'เมืองร้าง', placeLake: 'ทะเลสาบ', placeCave1: 'ถ้ำหินปูน', placeCave2: 'ถ้ำเหมืองเก่า', placeBridge: 'สะพานพัง',
  placeMountains: 'เทือกเขาหิมะ', placeRedwood: 'ป่าสนยักษ์', placeRainforest: 'หุบป่าดิบชื้น', placeDeciduous: 'ป่าผลัดใบ',
  placeFlowers: 'ทุ่งดอกไม้', placeOrchard: 'สวนผลไม้ร้าง', placeWetland: 'ที่ลุ่มน้ำ', placeDense: 'ป่าทึบ', placeVillage: 'หมู่บ้านกลางป่า', placeGas: 'ปั๊มน้ำมันร้าง', placeSawmill: 'โรงเลื่อย', placeRanger: 'ที่ทำการอุทยาน', placeLookout: 'หอดูไฟป่า', placeTrain: 'ขบวนรถไฟร้าง', placeStation: 'สถานีรถไฟร้าง',
  // รอบสอง ช่วง 0 (แก้จากผลตรวจ)
  logUnlocked: 'ได้บันทึกส่วนตัวของชิ้นนี้แล้ว',
  nestFailed: 'ใส่ซ้อนไม่ได้ ไม่มีกระเป๋าใบไหนรับน้ำหนักนี้ไหว',
  unnestFailed: 'แถบล่างเต็ม ไม่มีช่องให้วางกระเป๋า',
  saveFailed: 'บันทึกในเบราว์เซอร์นี้ไม่ได้ ความคืบหน้าจะไม่ถูกเก็บ',
  otherTab: 'เกมนี้เปิดอยู่อีกแท็บ แท็บนี้หยุดบันทึกเพื่อไม่ให้ทับกัน',
  quitNoSave: 'ปิดแท็บนี้ได้เลย',
  clickToPlay: 'คลิกจอเพื่อควบคุมกล้อง',
  tank: 'ถัง',
  catNature: 'ธรรมชาติ',
  crackStatus: 'โหลร้าว {n} จุด · ใช้ปืนกาวอุด',
  gearCount: 'อุปกรณ์ {n} ชิ้น', itemsCount: 'ของที่เก็บ {n} ชิ้น',
  layerN: 'ชั้นที่ {n}', depositedCount: 'อยู่ในยาน {n}', stepLess: 'ลด{what}', stepMore: 'เพิ่ม{what}',
} as const;

export type StrKey = keyof typeof th;

const en: Record<StrKey, string> = {
  stamina: 'Stamina',
  oxygen: 'Oxygen',
  battery: 'Battery',
  minimapHint: 'Press M for full map',
  compassN: 'N', compassNE: 'NE', compassE: 'E', compassSE: 'SE', compassS: 'S', compassSW: 'SW', compassW: 'W', compassNW: 'NW',
  armUR: 'Upper right', armUL: 'Upper left', armLR: 'Lower right', armLL: 'Lower left',
  main: 'main',
  empty: 'Empty',
  keyLeft: 'L-Click', keyRight: 'R-Click',
  beltHint: 'Blue dot = held in an arm · press a number to equip to main arm',
  scanner: 'Scanner', flashlight: 'Flashlight', inkGun: 'Ink Gun', glueGun: 'Glue Gun', climber: 'Climbing Gear', oxygenTank: 'Oxygen Tank',
  bagSmall: 'Small Bag', bagMedium: 'Medium Bag', bagLarge: 'Large Bag',
  short_scanner: 'Scan', short_flashlight: 'Light', short_inkGun: 'Ink', short_glueGun: 'Glue', short_climber: 'Climb', short_oxygenTank: 'Oxygen', short_bag: 'Bag',
  on: 'On', off: 'Off',
  ink: 'Ink', glue: 'Glue', tanks: 'tanks', charge: 'Battery',
  scanning: 'Scanning', scanNothing: 'Nothing to scan here', scanSent: 'Scan uploaded to ship',
  lightEmpty: 'Flashlight battery empty. Wait for sunlight', noInk: 'Out of ink', noGlue: 'Out of glue', noCracks: 'The jar has no cracks', sealed: 'Crack sealed',
  oxygenFull: 'Jar oxygen is already full', oxygenRefilled: 'Jar oxygen refilled', noTanks: 'No oxygen tanks left',
  bagHint: 'Press Tab or I to open your bag', charging: 'Solar charging',
  tabBag: 'Bag', tabCollection: 'Collection', closeTab: 'Close',
  bagOf: 'Bag', noBag: 'No bag carried. Items you pick up go into empty belt slots.',
  gearKg: 'Gear', itemsKg: 'Finds', totalKg: 'Total', kg: 'kg',
  dropBag: 'Drop this bag here', nestBag: 'Put inside another bag', unnestBag: 'Take nested bag out', nested: 'Nested',
  armSlots: 'ARM SLOTS · drag items here, or click an item then an arm', body: 'BODY', jarOk: 'Jar: no cracks', jarCracks: 'Jar cracks', jarO2: 'Jar oxygen', temp: 'Temperature', tempOk: 'normal', tempCold: 'cold',
  dragRotate: 'Drag to rotate', pickHint: 'Click an item in the bag to inspect it',
  catAll: 'All', catHuman: 'Human', catAnimal: 'Animals', catPlant: 'Plants', catSelf: 'My Remnants',
  unknown: '???', layer1: 'Layer 1 · My guess', layer2: 'Layer 2 · The truth', layer3: 'Layer 3 · My log',
  lockTruth: 'Scan 3 of this kind to unlock', lockLog: 'Nothing yet', noLog: 'No personal log for this kind',
  smallObj: 'Small object · can be collected', largeObj: 'Large object · scan only', deposited: 'in ship', scanned: 'scanned', notFound: 'Not found yet',
  shipTitle: 'Ship · Expedition Prep', shipSub: 'The ship can replicate gear without limit', starter: 'Starter Pack', depart: 'Depart',
  shipStock: 'SHIP STOCK · click to take or return · use + − to set amounts', willCarry: 'LOADOUT · 9-SLOT BELT', armsOnDepart: 'ARMS ON DEPARTURE', carryWeight: 'CARRY WEIGHT',
  taken: 'Taken', notTaken: 'Not taken', capKg: 'holds', weightNote: 'The heavier you are, the faster stamina drains when running, swimming and climbing. Over the limit, you cannot pick up more.', slotsFull: 'All 9 belt slots are full',
  warmth: 'WARMTH', warmOk: 'Inside ship · fully warm', depositedN: 'Items deposited into the collection: {n}', nothingDeposited: 'Nothing to deposit',
  pick: 'Pick up', enterShip: 'Enter ship', takeBag: 'Take bag', beacon: 'Send beacon to map', beaconOn: 'Bag beacon sent', bagFull: 'Too heavy. Return to the ship to store your finds.',
  pickedBag: 'Put in bag', pickedHand: 'Holding in belt', bagDropped: 'Bag dropped. No beacon sent yet.', newLayer: 'Unlocked', scanTarget: 'Looking at',
  cold: 'Cold · frost is creeping across the glass', cracked: 'Jar cracked', sealWithGlue: 'seal with Glue Gun', oxygenLow: 'Jar oxygen is dropping',
  deathFall: 'Jar Shattered', deathAnimal: 'Jar Shattered', deathDrown: 'The Octopus Suffocated', deathGas: 'The Octopus Suffocated', deathCold: 'Frozen',
  causeFall: 'Fell from a height', causeAnimal: 'Attacked by a wild animal', causeDrown: 'Drowned · jar oxygen ran out', causeGas: 'Toxic cave gas · jar oxygen ran out', causeCold: 'Stayed in the cold too long',
  quoteFall: '"I thought something was waiting down there. I was wrong."', quoteAnimal: '"It did not hate me. It was only afraid, as I was afraid of it."',
  quoteDrown: '"The water outside looked like the water in my jar. It was not."', quoteGas: '"The dark in the cave was not as frightening as its air."', quoteCold: '"The stars were beautiful tonight. I watched them too long."',
  bodyN: 'Body', ended: 'lost', cloning: 'Ship is replicating a new body', allDropped: 'Everything dropped at your remains', deathMarked: 'Death marked on map',
  gearN: 'gear', itemsN: 'finds', pieces: '', takeFromBody: 'Take items from remains', bodyEmpty: 'Nothing left on these remains', tookFromBody: 'Recovered items from remains', bodySomeLeft: 'Belt full · some items are still on the remains',
  respawned: 'The ship replicated a new body. Choose your gear before departing.', warmNearShip: 'Warming up',
  inkLabel: 'Ink effect', inkFlee: 'Panics and flees when inked, and slows down', inkIgnore: 'Ignores the ink, but the sticky ink slows it down', inkEnraged: 'Gets even more aggressive when inked. Careful.', attacked: 'Attacked · jar cracked',
  gameTitle: 'Remnant', tagline: 'What humanity left behind, on a planet with no one left', continueGame: 'Continue', dayN: 'Day', discoveries: 'Discovered', things: '',
  newGame: 'New Expedition', newGameConfirm: 'Starting over erases your progress. Click again to confirm.', settings: 'Settings', quitGame: 'Quit', quitNote: 'Saved. You can close this tab.', demoVer: 'Demo',
  worldMoved: 'The world is now 3 × 3 km · you start again at the ship, your collection and gear are kept',
  loadingLand: 'Shaping mountains, valleys and rivers', loadingLife: 'Growing forests, placing the town and everything in it',
  paused: 'Paused', toTitle: 'Main Menu', resume: 'Resume', gfxAudio: 'GRAPHICS & AUDIO', language: 'Language', langThai: 'ไทย', langEnglish: 'English',
  quality: 'Graphics', qLow: 'Low', qMed: 'Medium', qHigh: 'High', viewDist: 'View Distance', natureVol: 'Nature Volume', gearVol: 'Gear Volume', mouseSens: 'Mouse Sensitivity',
  progress: 'Progress', autoSaved: 'Auto-saved in this browser', controls: 'CONTROLS', saved: 'Saved',
  kMove: 'Move', kLook: 'Look', kRun: 'Run', kJump: 'Jump', kInteract: 'Pick up · Interact', kArmsTop: 'Use upper right / upper left arm', kArmsLow: 'Use lower right / lower left arm',
  kNum: 'Equip to main arm', kBag: 'Bag · Collection', kMap: 'Full Map', kEsc: 'Pause', kShoulder: 'Swap camera shoulder', kJarLight: 'Jar light on/off', kBeacon: 'Bag beacon',
  keyMouse: 'Mouse', keyNums: '1 – 9', keyTabI: 'Tab or I', keyLR: 'L-Click / R-Click', keyWheel: 'Wheel', kWheel: 'Cycle main-arm item',
  map: 'Map', mapSub: 'Explored', close: 'Close',
  legend: 'LEGEND', legShip: 'Ship', legMe: 'Me', legDeath: 'Last death · items still there', legOldBody: 'Old remains · items gone', legBag: 'Beaconed bag',
  mapNote1: "Bags dropped without a beacon won't show on the map. You'll have to find them yourself.",
  mapNote2: 'Dark areas are unexplored.',
  ship: 'Ship',
  km: 'km',
  mapZoomHint: 'Scroll to zoom · drag to move · double-click for the whole map', mapBodyN: 'Body {n}', bagMark: 'Bag',
  placeTown: 'Abandoned Town', placeLake: 'Lake', placeCave1: 'Limestone Cave', placeCave2: 'Old Mine', placeBridge: 'Broken Bridge',
  placeMountains: 'Snow Range', placeRedwood: 'Giant Pine Forest', placeRainforest: 'Rainforest Gorge', placeDeciduous: 'Broadleaf Woods',
  placeFlowers: 'Flower Fields', placeOrchard: 'Overgrown Orchard', placeWetland: 'Wetlands', placeDense: 'Deep Forest', placeVillage: 'Forest Village', placeGas: 'Old Gas Station', placeSawmill: 'Sawmill', placeRanger: 'Ranger Station', placeLookout: 'Fire Lookout', placeTrain: 'Abandoned Train', placeStation: 'Old Station',
  logUnlocked: 'Personal log unlocked',
  nestFailed: "Can't nest it · no bag can hold that much",
  unnestFailed: 'Belt full · no free slot for the bag',
  saveFailed: "Can't save in this browser · progress won't be kept",
  otherTab: "The game is open in another tab · this tab stopped saving so they don't overwrite each other",
  quitNoSave: 'You can close this tab.',
  clickToPlay: 'Click the screen to control the camera',
  tank: 'tank',
  catNature: 'Nature',
  crackStatus: 'Jar cracked in {n} places · seal with the Glue Gun',
  gearCount: 'Gear: {n}', itemsCount: 'Finds: {n}',
  layerN: 'Layer {n}', depositedCount: '{n} in ship', stepLess: 'Less {what}', stepMore: 'More {what}',
};

const TABLE: Record<Lang, Record<StrKey, string>> = { th, en };

let lang: Lang = 'th';
const listeners = new Set<() => void>();

export function getLang(): Lang {
  return lang;
}

export function setLang(l: Lang): void {
  lang = l;
  if (typeof document !== 'undefined') document.documentElement.lang = l;
  listeners.forEach((f) => f());
}

export function onLangChange(f: () => void): void {
  listeners.add(f);
}

/** ข้อความตามภาษาที่เลือก */
export function t(key: StrKey): string {
  return TABLE[lang][key];
}

/** ข้อความที่มีช่องใส่ค่า เช่น 'ฝากแล้ว {n} ชิ้น' */
export function tf(key: StrKey, vars: Record<string, string | number>): string {
  return t(key).replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));
}

/** ใช้ตอนทดสอบ: ทุกคำต้องมีครบสองภาษา */
export function allKeys(): StrKey[] {
  return Object.keys(th) as StrKey[];
}

export function tableFor(l: Lang): Record<StrKey, string> {
  return TABLE[l];
}
