// Rain.js
new p5(p => {
    const drops = [];
    const dropCount = 400;

    let windForce = 0;
    let targetWind = 0;
    let windChangeTimer = 0;

    p.setup = () => {
        p.createCanvas(p.windowWidth, p.windowHeight);

        for (let i = 0; i < dropCount; i++) {
            drops.push(new Drop());
        }
    };

    p.windowResized = () => {
        p.resizeCanvas(p.windowWidth, p.windowHeight);
    };

    p.draw = () => {
        p.clear(); // transparent background

        windChangeTimer++;
        if (windChangeTimer > 360) {
            targetWind = p.random(-3, 3);
            windChangeTimer = 0;
        }

        windForce = p.lerp(windForce, targetWind, 0.01);

        for (const d of drops) {
            d.fall();
            d.show();
        }
    };

    class Drop {
        constructor() {
            this.x = p.random(-100, p.windowWidth + 100);
            this.y = p.random(-p.windowHeight * 2, 0);
            this.z = p.random(0, 20);
            this.len = p.map(this.z, 0, 20, 10, 20);
            this.yspeed = p.map(this.z, 0, 20, 4, 10);
            this.opacity = p.map(this.z, 0, 20, 100, 255);
        }

        fall() {
            this.y += this.yspeed;
            this.yspeed += 0.05;

            this.x += windForce * p.map(this.z, 0, 20, 0.5, 1.5);

            if (this.y > p.windowHeight) {
                this.y = p.random(-p.windowHeight, 0);
                this.yspeed = p.map(this.z, 0, 20, 4, 10);
            }

            if (this.x < -50) this.x = p.windowWidth + 50;
            if (this.x > p.windowWidth + 50) this.x = -50;
        }

        show() {
            const thick = p.map(this.z, 0, 20, 1, 3);
            p.strokeWeight(thick);
            p.stroke(150, 180, 220, this.opacity);

            const angle = windForce * 0.1;
            const endX = this.x + this.len * p.sin(angle);
            const endY = this.y + this.len * p.cos(angle);

            p.line(this.x, this.y, endX, endY);
        }
    }
});
