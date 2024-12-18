var drops = [];
var p;

const dropCount = 250;

function setup() {
    let t = random(0, 500);

    p = palette(t,
        createVector(0.5, 0.5, 0.5), // `a`
        createVector(0.5, 0.5, 0.1), // `b`
        createVector(1.8, 1.0, 0.8), // `c`
        createVector(0.0, 0.34, 0.67) // `d`
    ).mult(255);

    createCanvas(windowWidth, windowHeight);
    windowResized();

    for (var i = 0; i < dropCount; i++) {
        drops[i] = new Drop();
    }
}

function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
}

// Sketch freaks out a bit if the scale of the window changes. I don't really care (or know how) to fix that
// right now, but for the future it might be nice, if we even stick with this sketch.x

// https://iquilezles.org/articles/palettes/
function palette(t, a, b, c, d) {
    // Calculate the scalar term (c * t + d) for each component
    let scalarTerm = createVector(c.x * t + d.x, c.y * t + d.y, c.z * t + d.z); // Apply c * t + d for each component

    // Apply cosine function to each component of scalarTerm
    let cosTerm = createVector(cos(TWO_PI * scalarTerm.x), cos(TWO_PI * scalarTerm.y), cos(TWO_PI * scalarTerm.z));

    // Perform the final color calculation
    let result = a.add(b.copy().mult(cosTerm));  // Multiply b by cosTerm and add to a

    return result;
}

function draw() {
    background(241, 226, 255, random(8, 16));
    for (var i = 0; i < drops.length; i++) {
        drops[i].fall();
        drops[i].show();
    }
}

// Purple Rain in p5js

function Drop() {
    this.x = random(windowWidth);
    this.y = random(-0, -windowHeight);
    this.z = random(0, 20);
    this.len = map(this.z, 0, 20, 10, 20);
    this.yspeed = map(this.z, 0, 20, 4, 10);
    this.r = random(0, 255);
    this.g = random(0, 255);
    this.b = random(0, 255);
  
    this.fall = function() {
        this.y = this.y + this.yspeed;
        this.yspeed += 0.05;
        
        if (this.y > windowHeight) {
            this.y = random(-0, -windowHeight);
            this.yspeed = map(this.z, 0, 20, 4, 10);
        }
        
        this.x += tan(sin(this.y) + random(-3, 3) * random(1, sin(8 * this.y)));
        if (this.x < 0 || this.x > windowWidth) {
            this.x = random(windowWidth);
        }
    }
  
    this.show = function() {
        var thick = map(this.z, 0, 20, 1, 3);
        strokeWeight(thick * random(1, 2.5));
        stroke(this.r + this.y, this.g, this.b * thick, 255 * 1/thick);
        noFill()
        line(this.x, this.y, this.x, this.y + this.len);
    }
}