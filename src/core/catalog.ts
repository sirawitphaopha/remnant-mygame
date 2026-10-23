import { NEW_ANIMALS, NEW_FLOWERS, NEW_ROCKS, NEW_SHRUBS, NEW_TREES, WATER_PLANTS } from './catalogNature';

// รายการของทุกชนิดที่สแกนได้ · ข้อความสแกน 3 ชั้น ไทยและอังกฤษ
// ชั้น 1 เอเลี่ยนเดา (สแกนครั้งแรก) · ชั้น 2 ความจริง (สแกนชนิดเดียวกันครบ 3 ชิ้น) · ชั้น 3 บันทึกส่วนตัว (เฉพาะบางชิ้นที่พิเศษ)
// 🔴 ชั้น 2 เขียนเป็นข้อเท็จจริงทั่วไป ไม่ใส่ตัวเลขที่ไม่มีแหล่งอ้างอิง

export type Category = 'human' | 'animal' | 'plant' | 'nature' | 'self';
export interface Txt { th: string; en: string }

export interface Kind {
  id: string;
  category: Category;
  /** ของชิ้นเล็กเก็บได้ · ของใหญ่สแกนอย่างเดียว */
  small: boolean;
  kg?: number;
  name: Txt;
  /** ชื่อที่เอเลี่ยนตั้งเองตอนยังไม่รู้ */
  alienName: Txt;
  guess: Txt;
  truth: Txt;
  log?: Txt;
}

const k = (id: string, category: Category, small: boolean, kg: number | undefined, name: Txt, alienName: Txt, guess: Txt, truth: Txt, log?: Txt): Kind =>
  ({ id, category, small, kg, name, alienName, guess, truth, log });

export const KINDS: Kind[] = [
  // ===== ของมนุษย์ ชิ้นเล็ก เก็บได้ =====
  k('teddy', 'human', true, 0.3, { th: 'ตุ๊กตาหมี', en: 'Teddy Bear' }, { th: 'สัตว์ยัดนุ่น', en: 'Stuffed Creature' },
    { th: 'สัตว์ตัวเล็กที่ถูกยัดนุ่นไว้ข้างใน มันไม่มีหัวใจ แต่มีรอยเย็บตรงที่หัวใจควรอยู่', en: 'A small animal stuffed with soft fibre. It has no heart, only a stitch where a heart should be.' },
    { th: 'ตุ๊กตาหมี — ของเล่นผ้าของเด็กมนุษย์ เด็กมักกอดไว้ตอนนอน', en: 'Teddy bear — a cloth toy for human children, often held while they slept.' },
    { th: 'ฉันวางมันไว้ข้างโหลตอนนอน ฉันไม่รู้ว่าทำไม', en: 'I put it beside my jar when I rest. I do not know why.' }),
  k('phone', 'human', true, 0.2, { th: 'โทรศัพท์', en: 'Phone' }, { th: 'แผ่นกระจกดำ', en: 'Black Glass Slab' },
    { th: 'แผ่นกระจกบาง ๆ ที่ไม่สะท้อนอะไรเลย มนุษย์คงใช้มองตัวเองตอนมันยังสว่างอยู่', en: 'A thin slab of glass that reflects nothing. Humans must have looked into it while it still glowed.' },
    { th: 'โทรศัพท์มือถือ — เครื่องที่มนุษย์ใช้คุยกับคนที่อยู่ไกล ส่งข้อความ ถ่ายภาพ', en: 'Mobile phone — a device humans used to talk across distances, send messages and take pictures.' },
    { th: 'ในเครื่องนี้มีภาพที่ยังไม่ได้ส่ง ฉันสงสัยว่าใครควรได้รับมัน', en: 'There are pictures in this one that were never sent. I wonder who they were for.' }),
  k('bottle', 'human', true, 0.6, { th: 'ขวดแก้ว', en: 'Glass Bottle' }, { th: 'โหลเล็กไร้ปลาหมึก', en: 'Empty Little Jar' },
    { th: 'โหลแก้วแบบเดียวกับที่ฉันอาศัยอยู่ แต่เล็กเกินไป และว่างเปล่า', en: 'A glass jar like the one I live in, but too small, and empty.' },
    { th: 'ขวดแก้ว — ภาชนะใส่น้ำหรือเครื่องดื่มของมนุษย์', en: 'Glass bottle — a container humans used for water and drinks.' }),
  k('watch', 'human', true, 0.1, { th: 'นาฬิกาข้อมือ', en: 'Wristwatch' }, { th: 'กำไลนับเลข', en: 'Counting Bracelet' },
    { th: 'กำไลที่มีเข็มเล็ก ๆ ชี้ไปที่ตัวเลข เข็มหยุดนิ่งแล้ว', en: 'A bracelet with tiny needles pointing at numbers. The needles have stopped.' },
    { th: 'นาฬิกาข้อมือ — เครื่องบอกเวลาที่มนุษย์สวมไว้ที่ข้อมือ', en: 'Wristwatch — a timekeeping device humans wore on the wrist.' }),
  k('glasses', 'human', true, 0.05, { th: 'แว่นตา', en: 'Glasses' }, { th: 'ตาสำรอง', en: 'Spare Eyes' },
    { th: 'ตาแก้วสองดวงที่ต่อกันด้วยลวด มนุษย์คงมีตาไม่พอ', en: 'Two glass eyes joined by wire. Humans must not have had enough eyes.' },
    { th: 'แว่นตา — เลนส์ช่วยให้มนุษย์ที่สายตาไม่ดีมองเห็นชัดขึ้น', en: 'Glasses — lenses that helped humans with weak sight see clearly.' }),
  k('frame', 'human', true, 0.9, { th: 'กรอบรูป', en: 'Picture Frame' }, { th: 'หน้าต่างเล็ก', en: 'Tiny Window' },
    { th: 'หน้าต่างบานเล็กที่มองเห็นมนุษย์ยิ้มอยู่ข้างใน แต่พวกเขาไม่ขยับเลย', en: 'A tiny window with smiling humans inside. They never move.' },
    { th: 'กรอบรูป — มนุษย์ใส่ภาพคนที่รักไว้ในกรอบ แล้วตั้งไว้ในบ้าน', en: 'Picture frame — humans framed pictures of people they loved and kept them at home.' },
    { th: 'ในรูปนี้ทุกคนหันมาทางฉัน ฉันพยายามยิ้มตอบ แต่ปลาหมึกยิ้มไม่เป็น', en: 'Everyone in this picture faces me. I tried to smile back, but octopuses cannot smile.' }),
  k('toycar', 'human', true, 0.2, { th: 'รถของเล่น', en: 'Toy Car' }, { th: 'กล่องเหล็กตัวจิ๋ว', en: 'Tiny Metal Box' },
    { th: 'กล่องเหล็กมีล้อแบบเดียวกับที่อยู่ตามถนน แต่เล็กจนมนุษย์เข้าไปข้างในไม่ได้', en: 'A wheeled metal box like the ones on the roads, but too small for any human to fit inside.' },
    { th: 'รถของเล่น — ของเล่นเด็กที่ทำเลียนแบบรถยนต์จริง', en: 'Toy car — a child\'s toy made to look like a real car.' }),
  k('book', 'human', true, 1.4, { th: 'หนังสือ', en: 'Book' }, { th: 'ชั้นแผ่นบาง', en: 'Stack of Thin Leaves' },
    { th: 'แผ่นบาง ๆ ซ้อนกันเต็มไปด้วยรอยขีดเล็ก ๆ บางทีอาจเป็นรอยเท้าของแมลง', en: 'Thin leaves stacked together, covered in tiny marks. Perhaps footprints of insects.' },
    { th: 'หนังสือ — มนุษย์จดเรื่องราว ความรู้ และความคิดไว้ด้วยตัวอักษร', en: 'Book — humans recorded stories, knowledge and thoughts in written letters.' }),
  k('keys', 'human', true, 0.1, { th: 'พวงกุญแจ', en: 'Keys' }, { th: 'ฟันเหล็ก', en: 'Metal Teeth' },
    { th: 'ฟันเหล็กหลายซี่ร้อยอยู่ในห่วง ไม่มีปากให้ใส่', en: 'Several metal teeth on a ring, with no mouth to fit them.' },
    { th: 'กุญแจ — ใช้เปิดประตูบ้านหรือรถที่ล็อกไว้', en: 'Keys — used to open locked doors of houses and cars.' }),
  k('coin', 'human', true, 0.01, { th: 'เหรียญ', en: 'Coin' }, { th: 'แผ่นกลมแวววาว', en: 'Shiny Disc' },
    { th: 'แผ่นโลหะกลม ๆ มีหน้ามนุษย์ประทับอยู่ มนุษย์คงพกหน้ากันและกันไว้ในกระเป๋า', en: 'A round metal disc stamped with a human face. Humans must have carried each other\'s faces in their pockets.' },
    { th: 'เหรียญ — เงินที่มนุษย์ใช้แลกเปลี่ยนของ', en: 'Coin — money humans used to trade for things.' }),
  // ===== ของมนุษย์ ชิ้นใหญ่ สแกนอย่างเดียว =====
  k('car', 'human', false, undefined, { th: 'รถยนต์', en: 'Car' }, { th: 'โครงเหล็กมีล้อ', en: 'Wheeled Metal Frame' },
    { th: 'โครงเหล็กมีล้อสี่ล้อ ข้างในมีที่นั่ง สิ่งมีชีวิตที่นี่คงขังตัวเองไว้ในกล่องแล้วให้กล่องพาไป', en: 'A metal frame with four wheels and seats inside. The creatures here must have shut themselves in boxes and let the boxes carry them.' },
    { th: 'รถยนต์ — พาหนะส่วนตัวของมนุษย์ ใช้เครื่องยนต์พาไปตามถนน', en: 'Car — a personal vehicle humans drove along roads with an engine.' },
    { th: 'คันนี้มีตุ๊กตาตัวเล็กวางอยู่ที่เบาะหลัง ฉันไม่รู้ว่ามันมีไว้ทำอะไร แต่ฉันไม่อยากหยิบมันออกมา', en: 'This one has a small doll on the back seat. I do not know what it was for, but I do not want to take it out.' }),
  k('bus', 'human', false, undefined, { th: 'รถบัส', en: 'Bus' }, { th: 'กล่องเหล็กยักษ์', en: 'Giant Metal Box' },
    { th: 'กล่องเหล็กมีล้อแบบเดียวกัน แต่ยาวมาก มีที่นั่งเป็นแถว มนุษย์คงชอบอยู่ด้วยกันเยอะ ๆ', en: 'The same wheeled box but very long, with rows of seats. Humans must have liked being together.' },
    { th: 'รถบัส — รถโดยสารขนาดใหญ่ พาคนจำนวนมากไปพร้อมกัน', en: 'Bus — a large vehicle that carried many people at once.' }),
  k('lamp', 'human', false, undefined, { th: 'เสาไฟ', en: 'Street Lamp' }, { th: 'ต้นไม้เหล็ก', en: 'Iron Tree' },
    { th: 'ต้นไม้เหล็กที่ไม่มีใบ ปลายยอดมีลูกแก้วแตก ๆ', en: 'An iron tree with no leaves and a broken glass fruit at the top.' },
    { th: 'เสาไฟถนน — ส่องแสงให้มนุษย์เดินทางตอนกลางคืน', en: 'Street lamp — it lit the roads for humans at night.' }),
  k('mailbox', 'human', false, undefined, { th: 'ตู้ไปรษณีย์', en: 'Mailbox' }, { th: 'กล่องปากแคบ', en: 'Narrow-Mouthed Box' },
    { th: 'กล่องที่มีปากแคบ ๆ ข้างในมีแผ่นกระดาษพับไว้ เหมือนมันกำลังรอใครสักคน', en: 'A box with a narrow mouth and folded paper inside, as if it is still waiting for someone.' },
    { th: 'ตู้ไปรษณีย์ — ที่ฝากจดหมายเพื่อส่งไปถึงคนอื่น', en: 'Mailbox — where letters were left to be delivered to others.' },
    { th: 'ข้างในยังมีจดหมายที่ไม่มีใครมาเก็บ ฉันปิดฝาให้มันเหมือนเดิม', en: 'There are still letters nobody collected. I closed the lid for them.' }),
  k('sign', 'human', false, undefined, { th: 'ป้ายถนน', en: 'Road Sign' }, { th: 'แผ่นชี้ทาง', en: 'Pointing Plate' },
    { th: 'แผ่นเหล็กที่ชี้ไปทางหนึ่ง พร้อมรอยขีดที่ฉันอ่านไม่ออก มันชี้ไปที่ไม่มีอะไร', en: 'A metal plate pointing somewhere, with marks I cannot read. It points at nothing.' },
    { th: 'ป้ายถนน — บอกทางและระยะทางไปยังที่ต่าง ๆ', en: 'Road sign — it told humans the way and the distance to places.' }),
  k('building', 'human', false, undefined, { th: 'ตึก', en: 'Building' }, { th: 'ภูเขาสี่เหลี่ยม', en: 'Square Mountain' },
    { th: 'ภูเขาที่สร้างขึ้นเอง ข้างในกลวงแบ่งเป็นห้อง ๆ มนุษย์คงขุดรังอยู่ข้างใน', en: 'A mountain they built themselves, hollow and divided into rooms. Humans must have nested inside.' },
    { th: 'ตึก — ที่อยู่อาศัยและที่ทำงานของมนุษย์', en: 'Building — where humans lived and worked.' }),
  k('bridge', 'human', false, undefined, { th: 'สะพาน', en: 'Bridge' }, { th: 'แขนหิน', en: 'Stone Arm' },
    { th: 'แขนหินยาวที่ยื่นข้ามน้ำ แต่มันหักกลาง เหมือนเอื้อมไปไม่ถึง', en: 'A long stone arm reaching across the water, broken in the middle, as if it could not reach.' },
    { th: 'สะพาน — ทางให้มนุษย์และรถข้ามแม่น้ำ', en: 'Bridge — a way for humans and cars to cross the river.' }),
  k('painting', 'human', false, undefined, { th: 'ภาพวาดในถ้ำ', en: 'Cave Painting' }, { th: 'ผนังที่มีมือ', en: 'Wall of Hands' },
    { th: 'รอยมือหลายรอยบนผนังหิน มือทุกมือมีห้านิ้ว ฉันวางหนวดลงไปเทียบ', en: 'Many handprints on the rock wall, each with five fingers. I placed my tentacle beside them.' },
    { th: 'ภาพวาดบนผนังถ้ำ — มนุษย์กลุ่มสุดท้ายมาหลบอยู่ที่นี่ และทิ้งรอยมือไว้', en: 'Cave painting — the last humans sheltered here and left their handprints.' },
    { th: 'มือเล็กที่สุดอยู่ต่ำที่สุด ฉันคิดว่าเป็นของเด็ก', en: 'The smallest hand is the lowest. I think it belonged to a child.' }),
  // ===== สัตว์ =====
  k('deer', 'animal', false, undefined, { th: 'กวาง', en: 'Deer' }, { th: 'สัตว์ขาเรียว', en: 'Slender-Legged Beast' },
    { th: 'สัตว์สี่ขาตาโต หัวมีกิ่งไม้งอก มันวิ่งหนีทุกครั้งที่ฉันเข้าใกล้', en: 'A four-legged animal with big eyes and branches growing from its head. It always runs from me.' },
    { th: 'กวาง — สัตว์กินพืช ขี้ตกใจ ออกหากินในทุ่งมากที่สุดตอนเช้ามืดกับพลบค่ำ ตัวเมียอยู่เป็นฝูงพาลูกไปด้วย มีตัวหนึ่งคอยเงยหน้าระวังภัย ศัตรูสำคัญคือหมาป่า', en: 'Deer — a shy plant-eater that comes out to graze mostly at dawn and dusk. Females live in herds with their young, one always keeping watch. Wolves are their main enemy.' }),
  k('rabbit', 'animal', false, undefined, { th: 'กระต่าย', en: 'Rabbit' }, { th: 'ก้อนขนหูยาว', en: 'Long-Eared Fluff' },
    { th: 'ก้อนขนนุ่ม ๆ หูยาว กระโดดไปมา', en: 'A soft ball of fur with long ears, hopping around.' },
    { th: 'กระต่าย — สัตว์ตัวเล็กกินหญ้า ขุดโพรงอยู่', en: 'Rabbit — a small grass-eater that lives in burrows.' }),
  k('fox', 'animal', false, undefined, { th: 'จิ้งจอก', en: 'Fox' }, { th: 'หางเปลวไฟ', en: 'Flame Tail' },
    { th: 'สัตว์สีส้มหางฟู มองฉันนานกว่าสัตว์ตัวอื่น', en: 'An orange animal with a bushy tail. It watches me longer than the others do.' },
    { th: 'จิ้งจอก — สัตว์ฉลาด กินสัตว์ฟันแทะตัวเล็กเป็นหลัก ล่ากระต่ายกับนก กินผลไม้ด้วย กระโดดข้ามรั้วสูงได้ ว่ายน้ำเก่ง', en: 'Fox — a clever hunter of mostly small rodents, also rabbits and birds, and it eats fruit too. It can leap high fences and swims well.' }),
  k('crow', 'animal', false, undefined, { th: 'อีกา', en: 'Crow' }, { th: 'เงาบิน', en: 'Flying Shadow' },
    { th: 'นกสีดำร้องเสียงแหบ บินวนเหนือซากเมือง', en: 'A black bird with a hoarse voice, circling above the ruins.' },
    { th: 'อีกา — นกฉลาด กินซากสัตว์ทุกชนิด แมลง เมล็ด ผลไม้ มักมารุมซากที่สัตว์อื่นล่าไว้ และจำหน้ากันได้', en: 'Crow — a clever bird that eats carrion of all kinds, insects, seeds and fruit. It gathers at other animals\' kills and can recognise faces.' }),
  // สัตว์ในถ้ำ (รอบสอง ช่วง 11) · ข้อเท็จจริงทั่วไป ไม่มีตัวเลข
  k('cavefish', 'animal', false, undefined, { th: 'ปลาถ้ำ', en: 'Cavefish' }, { th: 'ปลาไร้ตา', en: 'Eyeless Swimmer' },
    { th: 'ปลาสีขาวซีดว่ายวนในแอ่งน้ำมืด มันไม่มีตา แต่ว่ายหลบหนวดของฉันได้ทุกครั้ง', en: 'Pale white fish circling in the dark pool. They have no eyes, yet they dodge my tentacle every time.' },
    { th: 'ปลาถ้ำ — ปลาที่อยู่ในความมืดมาหลายชั่วรุ่นจนตาเสื่อมหายไปและตัวไม่มีสี หาทางด้วยการรับแรงสั่นในน้ำ', en: 'Cavefish — fish that lived in darkness for so many generations that their eyes and colour faded away. They find their way by feeling movement in the water.' }),
  k('bat', 'animal', false, undefined, { th: 'ค้างคาว', en: 'Bat' }, { th: 'ร่มบินได้', en: 'Flying Umbrella' },
    { th: 'สัตว์ตัวเล็กมีปีกเป็นแผ่นหนัง บินวนในความมืดโดยไม่ชนอะไรเลย', en: 'Small creatures with leathery wings, circling in the dark without touching anything.' },
    { th: 'ค้างคาว — สัตว์เลี้ยงลูกด้วยนมที่บินได้จริง หาทางในความมืดด้วยเสียงสะท้อน กลางวันห้อยหัวนอนในถ้ำ', en: 'Bat — a mammal that truly flies. It finds its way in the dark by echoes and sleeps hanging upside down in caves by day.' }),
  k('eagle', 'animal', false, undefined, { th: 'นกอินทรี', en: 'Eagle' }, { th: 'ปีกกว้าง', en: 'Wide Wings' },
    { th: 'นกตัวใหญ่ที่ลอยอยู่บนลมโดยไม่ต้องกระพือปีก', en: 'A large bird that floats on the wind without flapping.' },
    { th: 'นกอินทรี — นกล่าเหยื่อ สายตาดีมาก', en: 'Eagle — a bird of prey with sharp eyesight.' }),
  k('frog', 'animal', false, undefined, { th: 'กบ', en: 'Frog' }, { th: 'ตัวกระโดดเปียก', en: 'Wet Hopper' },
    { th: 'สัตว์ตัวเล็กผิวเปียก อยู่ได้ทั้งในน้ำและบนบก ร้องตอนกลางคืน', en: 'A small wet-skinned animal that lives in water and on land. It sings at night.' },
    { th: 'กบ — สัตว์สะเทินน้ำสะเทินบก กลางวันหลบในที่ชื้น กลางคืนออกหากินแมลง หอยทาก ไส้เดือน เปลี่ยนสีผิวให้เข้มหรืออ่อนกลืนกับที่อยู่ได้', en: 'Frog — an amphibian that hides somewhere damp by day and hunts insects, snails and worms at night. It can darken or lighten its skin to blend in.' }),
  k('butterfly', 'animal', false, undefined, { th: 'ผีเสื้อ', en: 'Butterfly' }, { th: 'กลีบบิน', en: 'Flying Petal' },
    { th: 'ดอกไม้ที่บินได้ ไปเกาะดอกไม้ที่บินไม่ได้', en: 'A flower that can fly, landing on flowers that cannot.' },
    { th: 'ผีเสื้อ — แมลงปีกสวย ช่วยผสมเกสรดอกไม้', en: 'Butterfly — a winged insect that helps pollinate flowers.' }),
  k('firefly', 'animal', false, undefined, { th: 'หิ่งห้อย', en: 'Firefly' }, { th: 'ดาวเตี้ย', en: 'Low Star' },
    { th: 'ดาวดวงเล็กที่ลอยต่ำ ๆ ใกล้พื้นตอนกลางคืน', en: 'Tiny stars that drift low near the ground at night.' },
    { th: 'หิ่งห้อย — แมลงที่เรืองแสงได้เอง', en: 'Firefly — an insect that makes its own light.' }),
  k('owl', 'animal', false, undefined, { th: 'นกฮูก', en: 'Owl' }, { th: 'ตาโตกลางคืน', en: 'Night Eyes' },
    { th: 'นกที่ตื่นตอนทุกอย่างหลับ หมุนหัวได้เกือบรอบ', en: 'A bird that wakes when everything sleeps, and turns its head almost all the way round.' },
    { th: 'นกฮูก — นกล่าเหยื่อตอนกลางคืน', en: 'Owl — a night-hunting bird.' }),
  k('wolf', 'animal', false, undefined, { th: 'หมาป่า', en: 'Wolf' }, { th: 'ฟันฝูง', en: 'Pack of Teeth' },
    { th: 'สัตว์ที่มาเป็นฝูง หอนใส่ดวงจันทร์ และวิ่งเข้าหาฉันแทนที่จะหนี', en: 'Animals that come in packs, howl at the moon, and run toward me instead of away.' },
    { th: 'หมาป่า — ล่าเป็นฝูง ไล่ตามเหยื่อที่วิ่งหนีแล้วแยกตัวที่อ่อนแอออกจากฝูง ล่าสัตว์ใหญ่สำเร็จไม่บ่อย นกตระกูลอีกามักมารุมซากที่หมาป่าทิ้งไว้', en: 'Wolf — hunts in packs, chasing fleeing prey and singling out the weakest from the herd. Hunts of large prey often fail. Ravens and crows gather at what wolves leave behind.' }),
  k('bear', 'animal', false, undefined, { th: 'หมี', en: 'Bear' }, { th: 'ภูเขาขน', en: 'Furry Mountain' },
    { th: 'สัตว์ตัวใหญ่ที่ยืนสองขาได้ เหมือนมนุษย์ตัวใหญ่ที่มีขน', en: 'A huge animal that can stand on two legs, like a big furry human.' },
    { th: 'หมี — สัตว์ใหญ่ แข็งแรงมาก แต่อาหารส่วนใหญ่เป็นพืช ลูกไม้ ลูกโอ๊ก เห็ด และลงจับปลาที่น้ำตกตอนปลากระโดด ออกหากินมากตอนเช้ากับหัวค่ำ', en: 'Bear — huge and very strong, yet it eats mostly plants: berries, acorns and mushrooms. It catches fish at waterfalls as they leap, and forages most in the morning and evening.' }),
  // สัตว์ใหม่รอบสอง ช่วง 12 กับปลาสองชนิด
  ...NEW_ANIMALS,
  // ===== พืช =====
  // รหัส pine คงไว้ให้บันทึกเก่าใช้ต่อได้ · รอบสอง ช่วง 12 เปลี่ยนเป็นสนสก็อต (ต้นสนชนิดเดียวในเกมที่เป็น pine จริง)
  k('pine', 'plant', false, undefined, { th: 'สนสก็อต', en: 'Scots Pine' }, { th: 'หอกเขียว', en: 'Green Spear' },
    { th: 'ต้นไม้ลำต้นยาวสีส้มแดง ยอดเป็นก้อนใบเข็มอยู่สูงลิบ เหมือนหอกที่ปักไว้ทั้งป่า', en: 'A tree with a long orange-red trunk and a tuft of needles far up top, like spears planted all over the forest.' },
    { th: 'สนสก็อต — ลำต้นยาวตรงโล่ง ยอดเป็นก้อนใบ เปลือกโคนต้นสีเทาน้ำตาลเป็นเกล็ด ช่วงบนสีส้มแดง ขึ้นได้บนดินทรายจนกับหินโผล่ ไปจนถึงแนวป่าสุดท้ายบนเขา', en: 'Scots pine — a long bare trunk and a rounded crown. Its lower bark is grey-brown and scaly, the upper bark orange-red. It grows on poor sandy soil and rocky ground up to the last trees on the mountain.' }),
  k('oak', 'plant', false, undefined, { th: 'ต้นโอ๊ก', en: 'Oak' }, { th: 'เมฆติดดิน', en: 'Grounded Cloud' },
    { th: 'ต้นไม้ที่ยอดเป็นก้อนกลมเหมือนเมฆที่ลงมาพักบนเสา', en: 'A tree whose crown is round like a cloud resting on a pole.' },
    { th: 'ต้นโอ๊ก — ไม้ใหญ่ทรงพุ่มแผ่กว้าง เปลือกเทาน้ำตาลร่องลึก อายุยืนเกิน 500 ปี บางต้นเกิน 1,000 ปี ทนน้ำท่วมเป็นครั้งคราว ลูกโอ๊กเป็นอาหารของหมีกับกระรอก', en: 'Oak — a large tree with a broad spreading crown and deeply furrowed grey-brown bark. It lives beyond 500 years, some over 1,000, tolerates occasional floods, and its acorns feed bears and squirrels.' }),
  k('birch', 'plant', false, undefined, { th: 'ต้นเบิร์ช', en: 'Birch' }, { th: 'กระดูกขาว', en: 'White Bone' },
    { th: 'ต้นไม้เปลือกขาวเหมือนกระดูก ใบสั่นตลอดเวลา', en: 'A tree with bark white as bone. Its leaves never stop trembling.' },
    { th: 'ต้นเบิร์ช — เปลือกขาวลอกเป็นแผ่นกระดาษมีรอยแตกดำ กิ่งเล็กห้อย เรือนยอดโปร่งแสงลอดถึงพื้น เป็นไม้เบิกนำที่ขึ้นก่อนใครบนที่โล่งหรือที่ไฟไหม้ ชอบแดดจัด', en: 'Birch — white bark peeling like paper with black cracks, drooping twigs, and a light crown that lets sunlight reach the ground. A pioneer that is first to grow on open or burnt land, and loves full sun.' }),
  k('dead', 'plant', false, undefined, { th: 'ต้นไม้ตาย', en: 'Dead Tree' }, { th: 'มือแห้ง', en: 'Dry Hand' },
    { th: 'ต้นไม้ที่ไม่มีใบ กิ่งชี้ขึ้นฟ้าเหมือนมือที่กำลังขอบางอย่าง', en: 'A leafless tree with branches raised like hands asking for something.' },
    { th: 'ต้นไม้ที่ตายแล้ว — ยังยืนอยู่ เป็นบ้านของแมลงและนก', en: 'Dead tree — still standing, a home for insects and birds.' }),
  // ต้นไม้ 16 ชนิดใหม่ (รอบสอง ช่วง 12)
  ...NEW_TREES,
  // รหัส rock คงไว้ให้บันทึกเก่าใช้ต่อได้ · รอบสอง ช่วง 12 เป็นก้อนแกรนิต (หิน 6 ชนิดตามรูปจริง)
  k('rock', 'nature', false, undefined, { th: 'ก้อนหินแกรนิต', en: 'Granite Boulder' }, { th: 'สัตว์นอนนิ่ง', en: 'Sleeping Beast' },
    { th: 'สิ่งที่ไม่หายใจ ไม่ขยับ ฉันสแกนมันสามรอบเพื่อให้แน่ใจ', en: 'It does not breathe or move. I scanned it three times to be sure.' },
    { th: 'ก้อนหินแกรนิต — ก้อนเหลี่ยมมนมุม เพราะมุมกับขอบผุเร็วกว่าหน้าเรียบ บางก้อนถูกธารน้ำแข็งพามาทิ้งไว้ไกลจากต้นกำเนิด อยู่โดดเดี่ยวกลางทุ่ง ไลเคนกับมอสค่อย ๆ ย่อยผิวหินเป็นดิน', en: 'Granite boulder — blocky with rounded corners, because corners and edges weather faster than flat faces. Some were carried far from their source by glaciers and left alone in a field. Lichen and moss slowly turn the surface into soil.' }),
  ...NEW_ROCKS,
  k('fern', 'plant', false, undefined, { th: 'เฟิร์น', en: 'Fern' }, { th: 'ขนนกพื้นดิน', en: 'Ground Feather' },
    { th: 'ใบเหมือนขนนกที่งอกจากดิน', en: 'Leaves like feathers growing out of the ground.' },
    { th: 'เฟิร์น — พืชที่ขึ้นในที่ร่มชื้น ไม่มีดอก', en: 'Fern — a flowerless plant that grows in damp shade.' }),
  k('flower', 'plant', false, undefined, { th: 'ดอกไม้ป่า', en: 'Wildflower' }, { th: 'สีที่ขึ้นจากดิน', en: 'Colour From the Ground' },
    { th: 'สีหลายสีที่โผล่จากดินโดยไม่มีใครปลูก', en: 'Colours rising from the soil that nobody planted.' },
    { th: 'ดอกไม้ป่า — ดอกไม้ที่ขึ้นเองตามธรรมชาติ', en: 'Wildflower — flowers that grow on their own.' }),
  // ดอกไม้ 13 ชนิด พืชริมน้ำ พุ่มไม้ (รอบสอง ช่วง 12)
  ...NEW_FLOWERS,
  ...WATER_PLANTS,
  ...NEW_SHRUBS,
  k('mushroom', 'plant', false, undefined, { th: 'เห็ด', en: 'Mushroom' }, { th: 'ร่มจิ๋ว', en: 'Tiny Umbrella' },
    { th: 'ร่มเล็ก ๆ ที่กางรอฝนอยู่บนพื้นป่า', en: 'Tiny umbrellas opened on the forest floor, waiting for rain.' },
    { th: 'เห็ด — ไม่ใช่พืช เป็นเชื้อรา ช่วยย่อยใบไม้ที่ร่วง', en: 'Mushroom — not a plant but a fungus that breaks down fallen leaves.' }),
  k('glowshroom', 'plant', false, undefined, { th: 'เห็ดเรืองแสง', en: 'Glowing Mushroom' }, { th: 'ไฟใต้ดิน', en: 'Underground Lantern' },
    { th: 'เห็ดที่ส่องแสงสีฟ้าในความมืดของถ้ำ เหมือนไฟที่หน้าอกของฉัน', en: 'Mushrooms that glow blue in the cave dark, like the light on my chest.' },
    { th: 'เห็ดเรืองแสง — เชื้อราบางชนิดเปล่งแสงได้เอง', en: 'Glowing mushroom — some fungi make their own light.' }),
  // ===== ร่องรอยของตัวเอง =====
  k('remains', 'self', false, undefined, { th: 'ซากร่างของฉัน', en: 'My Remains' }, { th: 'ร่างเก่า', en: 'Old Body' },
    { th: 'ชุดที่ว่างเปล่า โหลแตก ไม่มีปลาหมึกอยู่ข้างใน', en: 'An empty suit with a shattered jar. No octopus inside.' },
    { th: 'ร่างที่ยานจำลองให้ฉันก่อนหน้านี้', en: 'A body the ship made for me before this one.' },
    { th: 'ฉันจำไม่ได้ว่าตอนนั้นคิดอะไรอยู่', en: 'I cannot remember what I was thinking then.' }),
];

export const KIND_BY_ID = new Map(KINDS.map((x) => [x.id, x]));

export function kind(id: string): Kind | undefined {
  return KIND_BY_ID.get(id);
}
