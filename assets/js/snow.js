new p5(p => {
    const flakes = [];
    const flakeCount = 150;

    p.setup = () => {
        p.createCanvas(p.windowWidth, p.windowHeight);

        for (let i = 0; i < flakeCount; i++) {
            flakes.push(new Snowflake());
        }
    };

    p.windowResized = () => {
        p.resizeCanvas(p.windowWidth, p.windowHeight);
    };

    p.draw = () => {
        p.clear(); // transparent background

        for (const f of flakes) {
            f.fall();
            f.show();
        }
    };

    class Snowflake {
        constructor() {
            this.reset(true);
            this.z = p.random(0, 20);
            this.size = p.map(this.z, 0, 20, 2, 8);
            this.yspeed = p.map(this.z, 0, 20, 0.5, 2);
            this.xspeed = p.random(-0.25, 0.25);
            this.opacity = p.map(this.z, 0, 20, 100, 255);
            this.wobble = p.random(0, p.TWO_PI);
        }

        reset(fromTop = false) {
            this.x = p.random(-50, p.windowWidth + 50);
            this.y = fromTop
                ? p.random(-p.windowHeight, 0)
                : p.random(-200, 0);
        }

        fall() {
            this.y += this.yspeed;
            this.wobble += 0.03;
            this.x += p.sin(this.wobble) * 0.5 + this.xspeed;

            // Vertical wrap
            if (this.y > p.windowHeight + 20) {
                this.reset();
            }

            // Horizontal wrap
            if (this.x < -50) this.x = p.windowWidth + 50;
            if (this.x > p.windowWidth + 50) this.x = -50;
        }

        show() {
            p.noStroke();

            p.fill(255, 255, 255, this.opacity);
            p.ellipse(this.x, this.y, this.size);

            if (this.size > 4) {
                p.fill(255, 255, 255, this.opacity * 0.3);
                p.ellipse(this.x, this.y, this.size * 1.5);
            }
        }
    }
});
