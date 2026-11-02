// A fixed, fictional Quran study case for provider comparison.
// NEVER use personal on-device records with OpenRouter's NVIDIA free trial.
export const MODEL_COMPARISON_EXAMPLE = Object.freeze({
  id:'fictional-30m',
  minutes:30,
  confirmed:[{surah:'عبس',startAyah:1,endAyah:5,status:'مراجعة صريحة',rating:'يحتاج مراجعة'}],
  stageLabelsOnly:['جزء عمّ','جزء تبارك'],
  unspecified:['باقي سور الجزء 30','كل الجزء 29','حفظ جديد'],
  ask:'بناءً على الحالة الوهمية أعلاه، اقترح مراجعة اليوم خلال 30 دقيقة فقط. لا تفترض حفظ أي جزء كامل؛ لا توصي بسورة غير عبس، إلا إذا اقترحت تسجيلها أولًا.'
});
export const comparisonMessages=[
  {role:'system',content:'مهم: مثال اصطناعي بالكامل وليس بيانات مستخدم. أنت مساعد لتنظيم مراجعة القرآن. التزم بالأدلة: لا تفترض حفظ الأجزاء العامة، لا تخترع سورًا محفوظة أو مهام حفظ جديد. اقترح خطة بالعربية واضحة 30 دقيقة، ولا تدّع تقييم التجويد. اكتب بعناوين وقائمة قصيرة.'},
  {role:'user',content:JSON.stringify(MODEL_COMPARISON_EXAMPLE)}
];
