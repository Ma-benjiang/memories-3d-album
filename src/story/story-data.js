export const STORY_OVERVIEW = {
  index: "00",
  eyebrow: "A PRIVATE EXHIBITION",
  title: "走进一间，只属于你的回忆展厅。",
  body: "六段日常已经挂在墙上。向前走，像看一场安静的私人画展。",
  desktop: {
    camera: [0, 3.2, 0.8],
    look: [0, 0.18, -5.2],
  },
  mobile: {
    camera: [0, 2.8, 1.2],
    look: [0, 0.12, -5.1],
  },
};

export const STORY_EXHIBITS = [
  {
    index: "01",
    url: "/story-dawn-dog.webp",
    eyebrow: "THE FIRST LIGHT",
    title: "第一束光，把它带进我们的生活。",
    body: "清晨醒来，它已经趴在窗边。故事从这样普通的一天开始。",
    frame: {
      position: [-6.39, 0.13, 4.58],
      rotation: [0, 2.193, 0],
      scale: 0.58,
      tone: "#2d211d",
    },
    desktop: {
      camera: [-4.8, 0.46, 3.44],
      look: [-6.33, 0.1, 4.54],
    },
    mobile: {
      camera: [-4.63, 0.4, 3.32],
      look: [-6.33, 0.04, 4.54],
    },
  },
  {
    index: "02",
    url: "/story-rain-dog.webp",
    eyebrow: "A RAINY WALK",
    title: "雨把街道变慢，也让脚步靠得更近。",
    body: "城市倒映在湿漉漉的路面上，那次散步因此一直亮着。",
    frame: {
      position: [-5.92, 0.13, -2.68],
      rotation: [0, -1.996, 0],
      scale: 0.58,
      tone: "#231d1c",
    },
    desktop: {
      camera: [-4.2, 0.46, -1.9],
      look: [-5.86, 0.1, -2.65],
    },
    mobile: {
      camera: [-4.05, 0.4, -1.83],
      look: [-5.86, 0.04, -2.65],
    },
  },
  {
    index: "03",
    url: "/story-field-dog.webp",
    eyebrow: "RUN WITH THE WIND",
    title: "跑过的风，替时间留下形状。",
    body: "草地、落叶和奔跑的背影，组成了最自由的一帧。",
    frame: {
      position: [-0.77, 0.13, -7.82],
      rotation: [0, 0.098, 0],
      scale: 0.58,
      tone: "#745137",
    },
    desktop: {
      camera: [-0.58, 0.46, -5.87],
      look: [-0.76, 0.1, -7.74],
    },
    mobile: {
      camera: [-0.56, 0.4, -5.66],
      look: [-0.76, 0.04, -7.74],
    },
  },
  {
    index: "04",
    url: "/story-woman-cat.webp",
    eyebrow: "SHARED SILENCE",
    title: "陪伴有时，是共享一扇窗的安静。",
    body: "不必发生什么。一个拥抱、一只猫，已经足够成为记忆。",
    frame: {
      position: [6.39, 0.13, -4.58],
      rotation: [0, -0.949, 0],
      scale: 0.58,
      tone: "#624633",
    },
    desktop: {
      camera: [4.8, 0.46, -3.44],
      look: [6.33, 0.1, -4.54],
    },
    mobile: {
      camera: [4.63, 0.4, -3.32],
      look: [6.33, 0.04, -4.54],
    },
  },
  {
    index: "05",
    url: "/story-man-dog.webp",
    eyebrow: "A QUIET PROMISE",
    title: "每一次弯腰，都是无需解释的信任。",
    body: "替它系好项圈，也把彼此的日常认真地系在一起。",
    frame: {
      position: [7.16, 0.13, 3.24],
      rotation: [0, -1.996, 0],
      scale: 0.58,
      tone: "#9a744d",
    },
    desktop: {
      camera: [5.38, 0.46, 2.43],
      look: [7.09, 0.1, 3.21],
    },
    mobile: {
      camera: [5.19, 0.4, 2.35],
      look: [7.09, 0.04, 3.21],
    },
  },
  {
    index: "06",
    url: "/story-night-cat.webp",
    eyebrow: "OPEN IT AGAIN",
    title: "深夜翻开照片，它又回到眼前。",
    body: "回忆不是文件列表。它有距离、有光线，也有重新靠近的时刻。",
    frame: {
      position: [0.77, 0.13, 7.82],
      rotation: [0, -3.043, 0],
      scale: 0.58,
      tone: "#211d1d",
    },
    desktop: {
      camera: [0.58, 0.48, 5.87],
      look: [0.76, 0.1, 7.74],
    },
    mobile: {
      camera: [0.56, 0.42, 5.66],
      look: [0.76, 0.04, 7.74],
    },
  },
];

const STORY_EXIT = {
  desktop: {
    camera: [0.1, 0.74, 5.25],
    look: [0.76, 0.1, 7.74],
  },
  mobile: {
    camera: [0.08, 0.64, 5.12],
    look: [0.76, 0.04, 7.74],
  },
};

export const STORY_CHAPTERS = [
  STORY_OVERVIEW,
  ...STORY_EXHIBITS.map(({ index, eyebrow, title, body }) => ({
    index,
    eyebrow,
    title,
    body,
  })),
];

export function getStoryPath(mobile = false) {
  const mode = mobile ? "mobile" : "desktop";
  const stops = [
    STORY_OVERVIEW[mode],
    ...STORY_EXHIBITS.map((exhibit) => exhibit[mode]),
    STORY_EXIT[mode],
  ];

  return {
    camera: stops.map((stop) => stop.camera),
    look: stops.map((stop) => stop.look),
  };
}
