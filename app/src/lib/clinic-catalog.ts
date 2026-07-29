export type LocalizedText = { en: string; ar: string };

export type Department = {
  slug: string;
  name: LocalizedText;
  summary: LocalizedText;
};

export type ClinicService = {
  slug: string;
  departmentSlug: string;
  name: LocalizedText;
  summary: LocalizedText;
  durationMinutes?: number;
};

export type Branch = {
  slug: string;
  name: LocalizedText;
  area: LocalizedText;
};

export const departments: Department[] = [
  { slug: 'bariatric-surgery', name: { en: 'Obesity & bariatric surgery', ar: 'السمنة وجراحة السمنة' }, summary: { en: 'Assessment and surgical care for obesity, with coordinated follow-up.', ar: 'تقييم ورعاية جراحية للسمنة مع متابعة متكاملة.' } },
  { slug: 'gastroenterology', name: { en: 'Gastroenterology, endoscopy & liver', ar: 'الجهاز الهضمي والمناظير والكبد' }, summary: { en: 'Specialist assessment for digestive, endoscopy, and liver concerns.', ar: 'تقييم متخصص لأمراض الجهاز الهضمي والمناظير والكبد.' } },
  { slug: 'nutrition', name: { en: 'Clinical nutrition', ar: 'التغذية العلاجية' }, summary: { en: 'Evidence-based nutrition plans supporting treatment and long-term health.', ar: 'خطط تغذية علاجية مبنية على الدليل لدعم العلاج والصحة طويلة المدى.' } },
  { slug: 'plastic-surgery', name: { en: 'Plastic & reconstructive surgery', ar: 'جراحة التجميل والترميم' }, summary: { en: 'Specialist surgical consultation with clear, clinically appropriate guidance.', ar: 'استشارة جراحية متخصصة وإرشادات طبية واضحة ومناسبة.' } },
  { slug: 'general-surgery', name: { en: 'General & specialist surgery', ar: 'الجراحة العامة والتخصصية' }, summary: { en: 'Consultation, diagnosis, and planned surgical care across specialist pathways.', ar: 'الاستشارة والتشخيص والرعاية الجراحية المخططة ضمن مسارات تخصصية.' } },
];

export const services: ClinicService[] = [
  { slug: 'bariatric-consultation', departmentSlug: 'bariatric-surgery', name: { en: 'Bariatric surgery consultation', ar: 'استشارة جراحة السمنة' }, summary: { en: 'A specialist assessment of symptoms, history, and suitable treatment pathways.', ar: 'تقييم متخصص للأعراض والتاريخ الصحي والمسارات العلاجية المناسبة.' }, durationMinutes: 30 },
  { slug: 'gastroenterology-consultation', departmentSlug: 'gastroenterology', name: { en: 'Gastroenterology consultation', ar: 'استشارة الجهاز الهضمي' }, summary: { en: 'Assessment of digestive or liver symptoms and the appropriate next steps.', ar: 'تقييم أعراض الجهاز الهضمي أو الكبد وتحديد الخطوات المناسبة.' }, durationMinutes: 30 },
  { slug: 'nutrition-consultation', departmentSlug: 'nutrition', name: { en: 'Clinical nutrition consultation', ar: 'استشارة تغذية علاجية' }, summary: { en: 'Personalised nutrition assessment aligned with your clinical care plan.', ar: 'تقييم تغذوي شخصي متوافق مع خطتك العلاجية.' }, durationMinutes: 30 },
  { slug: 'surgical-consultation', departmentSlug: 'general-surgery', name: { en: 'General surgery consultation', ar: 'استشارة الجراحة العامة' }, summary: { en: 'Review of a surgical concern, options, and recommended follow-up.', ar: 'مراجعة الحالة الجراحية والخيارات والمتابعة الموصى بها.' }, durationMinutes: 30 },
];

export const branches: Branch[] = [
  { slug: 'hawally', name: { en: 'Hawally branch', ar: 'فرع حولي' }, area: { en: 'Hawally, Kuwait', ar: 'حولي، الكويت' } },
  { slug: 'jahra', name: { en: 'Jahra branch', ar: 'فرع الجهراء' }, area: { en: 'Jahra, Kuwait', ar: 'الجهراء، الكويت' } },
];

export function departmentBySlug(slug: string) { return departments.find((item) => item.slug === slug); }
export function serviceBySlug(slug: string) { return services.find((item) => item.slug === slug); }
export function branchBySlug(slug: string) { return branches.find((item) => item.slug === slug); }

