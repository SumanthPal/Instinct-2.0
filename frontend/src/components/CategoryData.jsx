export const categoriesList = [
  'Diversity and Inclusion',
  'Greek Life',
  'International',
  'Peer Support',
  'Fitness',
  'Hobbies and Interests',
  'Religious and Spiritual',
  'Cultural and Social',
  'Technology',
  'Graduate',
  'Performance and Entertainment',
  'Career and Professional',
  'LGBTQ',
  'Academics and Honors',
  'Media',
  'Political',
  'Education',
  'Environmental',
  'Community Service',
  'Networking'
];

export const categoryEmojis = {
  'All': '📚',
  'Diversity and Inclusion': '🌈',
  'Greek Life': '🏛️',
  'International': '🌎',
  'Peer Support': '🤝',
  'Fitness': '🏋️',
  'Hobbies and Interests': '🎨',
  'Religious and Spiritual': '🕊️',
  'Cultural and Social': '🎭',
  'Technology': '💻',
  'Graduate': '🎓',
  'Performance and Entertainment': '🎬',
  'Career and Professional': '💼',
  'LGBTQ': '🏳️‍🌈',
  'Academics and Honors': '📖',
  'Media': '📱',
  'Political': '🗳️',
  'Education': '🏫',
  'Environmental': '🌱',
  'Community Service': '❤️',
  'Networking': '🔗',
};

export const categoryGroups = {
  'all': 'All Clubs',
  'academic': 'Academic',
  'cultural': 'Cultural',
  'career': 'Career',
  'interest': 'Interests'
};

export const getCategoryGroup = (category) => {
  if (['Academics and Honors', 'Education', 'Graduate', 'Technology'].includes(category)) {
    return 'academic';
  } else if (['Cultural and Social', 'International', 'Diversity and Inclusion', 'LGBTQ', 'Religious and Spiritual'].includes(category)) {
    return 'cultural';
  } else if (['Career and Professional', 'Networking', 'Media'].includes(category)) {
    return 'career';
  } else {
    return 'interest';
  }
};