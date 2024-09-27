<template>
    <div class="h-[100px] w-[100px] p-10">
        <div class="h-[100px] w-[100px]">
            <canvas ref="sample" style="width: 100%; height: 100%;" />
        </div>
    </div>
</template>
<script setup>
import { ref, onMounted } from 'vue';
import Chart from 'chart.js/auto';
const sample = ref(null);
onMounted(() => {
    if (sample.value) {
        const ctx = sample.value.getContext('2d');
        new Chart(ctx, {
            type: 'bar', 
            data: {
                labels: ["クルーウェル","クロウリー","クルーウェル","クルーウェル","クルーウェル"],
                datasets: [{
                    backgroundColor: ["red","orange","yellow","green","blue"],
                    data: ["30000","20000","30000","40000","50000"],
                    borderWidth: 1
                }],
            },
            options: {
                scales: {
                    x: {
                        ticks: {
                            font: {
                                size: 9
                            }
                        }
                    },
                    y: {
                        ticks: {
                            font: {
                                size: 9
                            }
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    borderWidth: 0
                }
            }
        });
    }
});
</script>
