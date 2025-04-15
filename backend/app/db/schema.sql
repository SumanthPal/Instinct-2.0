CREATE TABLE clubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  instagram_handle TEXT UNIQUE NOT NULL,
  profile_pic TEXT,
  description TEXT,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL
);
CREATE TABLE clubs_categories (
  club_id UUID REFERENCES clubs(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (club_id, category_id)
);


CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID REFERENCES clubs(id) ON DELETE CASCADE,
  instagram_post_id TEXT UNIQUE NOT NULL,
  caption TEXT,
  image_url TEXT,
  created_at TIMESTAMP DEFAULT now()
  posted TIMESTAMP NOT NULL
);

CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID REFERENCES clubs(id) ON DELETE CASCADE,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  date TIMESTAMP NOT NULL,
  details TEXT,
  duration INTERVAL,
  parsed JSONB, -- AI-enhanced event data, pulled from the post
  created_at TIMESTAMP DEFAULT now()
);
